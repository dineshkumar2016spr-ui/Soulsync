import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const root = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 5175
const isProduction = process.env.NODE_ENV === 'production'
const appId = process.env.INSTAGRAM_APP_ID
const appSecret = process.env.INSTAGRAM_APP_SECRET
const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `http://localhost:${port}/api/instagram/callback`
const scopes = ['instagram_basic', 'instagram_manage_messages', 'pages_show_list', 'pages_read_engagement']
const cookieName = 'muse_oauth_session'
const sessionTtlMs = 60 * 24 * 60 * 60 * 1000
const oauthStateTtlMs = 10 * 60 * 1000
const sessions = new Map()
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex')
const llmApiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters in production.')
}
if (isProduction && !process.env.INSTAGRAM_REDIRECT_URI) {
  throw new Error('Set INSTAGRAM_REDIRECT_URI to your exact public Instagram OAuth callback URL in production.')
}

function sign(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url')
}

function getSessionId(req) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))
  if (!cookie) return null
  let cookieValue
  try {
    cookieValue = decodeURIComponent(cookie.slice(cookieName.length + 1))
  } catch {
    return null
  }
  const [id, signature] = cookieValue.split('.')
  if (!id || !signature) return null
  const expected = sign(id)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  const session = sessions.get(id)
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(id)
    return null
  }
  session.expiresAt = Date.now() + sessionTtlMs
  return id
}

function getOrCreateSession(req, res) {
  const existing = getSessionId(req)
  if (existing) {
    const session = sessions.get(existing)
    if (session && !session.credits) {
      session.credits = { credits_remaining: 10, plan_type: 'free' }
    }
    return existing
  }
  const id = randomBytes(32).toString('base64url')
  sessions.set(id, { expiresAt: Date.now() + sessionTtlMs, credits: { credits_remaining: 10, plan_type: 'free' } })
  const secure = isProduction ? '; Secure' : ''
  res.append('Set-Cookie', `${cookieName}=${encodeURIComponent(`${id}.${sign(id)}`)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`)
  return id
}

function sameOrigin(req) {
  const origin = req.get('origin')
  return Boolean(origin) && origin === `${req.protocol}://${req.get('host')}`
}

function requireConfigured(res) {
  if (appId && appSecret && redirectUri) return true
  res.status(503).json({ error: 'Instagram Login is not configured. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_REDIRECT_URI on the server.' })
  return false
}

function requireAuth(req, res) {
  const sessionId = getSessionId(req)
  const session = sessionId ? sessions.get(sessionId) : null
  if (!session?.instagramAccount?.accessToken) {
    res.status(401).json({ error: 'Not connected to Instagram' })
    return null
  }
  return { sessionId, session, account: session.instagramAccount }
}

app.disable('x-powered-by')
app.set('trust proxy', isProduction ? 1 : false)
app.use(express.json())
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

app.get('/api/instagram/status', (req, res) => {
  const sessionId = getSessionId(req)
  const session = sessionId ? sessions.get(sessionId) : null
  const account = session?.instagramAccount
  if (session && !session.credits) {
    session.credits = { credits_remaining: 10, plan_type: 'free' }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ configured: Boolean(appId && appSecret), connected: Boolean(account), account: account ? { username: account.username, accountType: account.accountType, userId: account.userId } : null })
})

app.get('/api/user/credits', (req, res) => {
  const sessionId = getSessionId(req) || getOrCreateSession(req, res)
  const session = sessions.get(sessionId)
  if (session && !session.credits) {
    session.credits = { credits_remaining: 10, plan_type: 'free' }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json(session?.credits || { credits_remaining: 10, plan_type: 'free' })
})

app.post('/api/user/accept-terms', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin request rejected.' })
  const sessionId = getSessionId(req) || getOrCreateSession(req, res)
  const session = sessions.get(sessionId)
  if (session) {
    session.accepted_terms_at = new Date().toISOString()
    if (!session.credits) {
      session.credits = { credits_remaining: 10, plan_type: 'free' }
    }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true })
})

app.get('/api/instagram/login', (req, res) => {
  if (!requireConfigured(res)) return
  const sessionId = getOrCreateSession(req, res)
  const session = sessions.get(sessionId)
  const state = randomBytes(32).toString('base64url')
  session.oauthState = state
  session.oauthStateExpiresAt = Date.now() + oauthStateTtlMs
  const authorizationUrl = new URL('https://www.instagram.com/oauth/authorize')
  authorizationUrl.searchParams.set('client_id', appId)
  authorizationUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', scopes.join(','))
  authorizationUrl.searchParams.set('state', state)
  res.redirect(302, authorizationUrl.toString())
})

app.get('/api/instagram/callback', async (req, res) => {
  if (!requireConfigured(res)) return
  const sessionId = getSessionId(req)
  const session = sessionId ? sessions.get(sessionId) : null
  const returnedState = req.query.state
  const savedState = session?.oauthState
  const savedStateExpiresAt = session?.oauthStateExpiresAt
  delete session?.oauthState
  delete session?.oauthStateExpiresAt

  if (typeof req.query.error === 'string') {
    return res.redirect(`/?instagram_error=${encodeURIComponent(req.query.error_description || req.query.error)}`)
  }
  if (!session || typeof returnedState !== 'string' || typeof savedState !== 'string' || typeof savedStateExpiresAt !== 'number' || savedStateExpiresAt < Date.now() || returnedState.length !== savedState.length || !timingSafeEqual(Buffer.from(returnedState), Buffer.from(savedState))) {
    return res.status(400).send('Instagram login could not be verified. Start the connection again.')
  }
  if (typeof req.query.code !== 'string' || req.query.code.length > 4096) {
    return res.status(400).send('Instagram did not return an authorization code.')
  }

  try {
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: req.query.code.replace(/#_$/, ''),
    })
    const exchange = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form, signal: AbortSignal.timeout(15000) })
    const shortLived = await exchange.json()
    if (!exchange.ok || typeof shortLived.access_token !== 'string' || typeof shortLived.user_id !== 'number') {
      throw new Error('Instagram authorization-code exchange failed.')
    }

    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: shortLived.access_token }).toString()
    const longLivedResponse = await fetch(longLivedUrl, { signal: AbortSignal.timeout(15000) })
    const longLived = await longLivedResponse.json()
    if (!longLivedResponse.ok || typeof longLived.access_token !== 'string') {
      throw new Error('Instagram long-lived token exchange failed.')
    }

    const profileUrl = new URL('https://graph.instagram.com/me')
    profileUrl.search = new URLSearchParams({ fields: 'user_id,username,account_type', access_token: longLived.access_token }).toString()
    const profileResponse = await fetch(profileUrl, { signal: AbortSignal.timeout(15000) })
    const profile = await profileResponse.json()
    const accountType = typeof profile.account_type === 'string' ? profile.account_type.toUpperCase() : ''
    if (!profileResponse.ok || typeof profile.username !== 'string' || !['BUSINESS', 'CREATOR'].includes(accountType)) {
      throw new Error('The connected account must be an Instagram Business or Creator account.')
    }

    session.instagramAccount = {
      userId: String(profile.user_id ?? shortLived.user_id),
      username: profile.username,
      accountType,
      accessToken: longLived.access_token,
      expiresAt: Date.now() + Number(longLived.expires_in || 5184000) * 1000,
    }
    return res.redirect('/?instagram_connected=1')
  } catch (error) {
    console.error('Instagram OAuth callback failed:', error instanceof Error ? error.message : 'Unknown error')
    return res.redirect('/?instagram_error=connection_failed')
  }
})

app.post('/api/instagram/disconnect', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin request rejected.' })
  const sessionId = getSessionId(req)
  if (sessionId) {
    const session = sessions.get(sessionId)
    if (session) {
      delete session.instagramAccount
      delete session.oauthState
      delete session.oauthStateExpiresAt
      delete session.conversations
      delete session.activeThread
    }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ connected: false })
})

app.get('/api/instagram/conversations', async (req, res) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    // For Instagram Business accounts, fetch conversations via Graph API
    // Note: This requires proper permissions and may need page linking
    const url = new URL(`https://graph.facebook.com/v18.0/${auth.account.userId}/conversations`)
    url.searchParams.set('fields', 'id,participants,messages{message,from,created_time}')
    url.searchParams.set('access_token', auth.account.accessToken)
    
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Conversations fetch failed:', data)
      // Return empty array with helpful message if not configured properly
      return res.json({ conversations: [], error: 'Unable to fetch conversations. Ensure your Instagram Business account is linked to a Facebook Page and has proper permissions.' })
    }
    
    auth.session.conversations = data.data || []
    res.setHeader('Cache-Control', 'no-store')
    res.json({ conversations: data.data || [] })
  } catch (error) {
    console.error('Conversations fetch error:', error)
    res.status(500).json({ conversations: [], error: 'Failed to fetch conversations' })
  }
})

app.get('/api/instagram/messages/:threadId', async (req, res) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  try {
    const { threadId } = req.params
    const url = new URL(`https://graph.facebook.com/v18.0/${threadId}/messages`)
    url.searchParams.set('fields', 'id,message,from,created_time')
    url.searchParams.set('limit', '15')
    url.searchParams.set('access_token', auth.account.accessToken)
    
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Messages fetch failed:', data)
      return res.status(500).json({ error: 'Failed to fetch messages' })
    }
    
    auth.session.activeThread = { threadId, messages: data.data || [] }
    res.setHeader('Cache-Control', 'no-store')
    res.json({ messages: data.data || [] })
  } catch (error) {
    console.error('Messages fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

app.post('/api/analyze-chat', async (req, res) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  
  // Check credits
  if (auth.session.credits) {
    if (auth.session.credits.plan_type !== 'vip' && auth.session.credits.credits_remaining <= 0) {
      return res.status(402).json({ error: 'Insufficient credits', upgrade_required: true })
    }
  } else {
    auth.session.credits = { credits_remaining: 10, plan_type: 'free' }
  }
  
  try {
    const { messages, goal, relationship_goal } = req.body
    const selectedGoal = goal || relationship_goal || 'Serious love'
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' })
    }
    
    const chatContext = messages.map(m => `${m.from === 'you' ? 'User' : 'Match'}: ${m.text}`).join('\n')
    
    const prompt = `You are SoulSync, an expert Gen-Z relationship and dating communication assistant. Analyze the incoming chat history and the user's selected relationship goal. Evaluate match psychology, interest level (High/Medium/Low), reply timings, and intent. Provide a strategic reply matching modern youth slang (blending English and localized youth vibe).

Analyze this Instagram chat conversation and provide strategic advice based on the user's relationship goal: ${selectedGoal}

Chat context:
${chatContext}

Provide a response in this exact JSON format:
{
  "match_interest_score": <number 0-100>,
  "psychology_analysis": "<detailed analysis of match's psychology, interest level, and motivations>",
  "suggested_reply": "<strategic witty response matching modern youth conversation with appropriate Telugu-English slang if natural>",
  "timing_advice": "<advice on when and how to reply>"
}

Rules:
1. Analyze psychological state, interest level (High/Medium/Low), and reply timing
2. Generate strategic, witty suggested response matching modern youth conversation (Telugu-English slang)
3. Be authentic and helpful, not manipulative
4. Consider the relationship goal when crafting advice
5. Always respond with valid JSON only.`

    let analysisResult
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()
        if (text) {
          analysisResult = JSON.parse(text)
        }
      } catch (geminiError) {
        console.error('Gemini API error:', geminiError)
      }
    } else if (llmApiKey) {
      try {
        const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${llmApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful dating coach AI. Always respond with valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
          }),
          signal: AbortSignal.timeout(30000)
        })
        
        if (llmResponse.ok) {
          const llmData = await llmResponse.json()
          const content = llmData.choices?.[0]?.message?.content
          if (content) {
            analysisResult = JSON.parse(content)
          }
        }
      } catch (llmError) {
        console.error('LLM API error:', llmError)
      }
    }
    
    // Fallback analysis if LLM fails
    if (!analysisResult) {
      const theirMessages = messages.filter(m => m.from === 'them')
      const questions = theirMessages.filter(m => m.text?.includes('?')).length
      const score = Math.min(95, Math.max(40, 60 + questions * 10))
      
      analysisResult = {
        match_interest_score: score,
        psychology_analysis: `Based on the conversation, there's ${score > 70 ? 'good' : 'moderate'} interest. ${questions > 0 ? 'They\'re asking questions showing curiosity.' : 'Keep engaging to build more interest.'} For a ${selectedGoal} goal, focus on building emotional connection.`,
        suggested_reply: selectedGoal === 'Casual dating' ? "ayyo nice! spill the tea, what made you pick this spot?" : selectedGoal === 'Serious love' ? "that sounds really sweet yaar. tell me more about what you love about it" : "sounds interesting ra! what got you into that?",
        timing_advice: "Reply within 2-4 hours to maintain good momentum without seeming too eager."
      }
    }
    
    // Deduct credit if not VIP
    if (auth.session.credits && auth.session.credits.plan_type !== 'vip') {
      auth.session.credits.credits_remaining = Math.max(0, auth.session.credits.credits_remaining - 1)
    }
    
    res.setHeader('Cache-Control', 'no-store')
    res.json(analysisResult)
  } catch (error) {
    console.error('Analyze chat error:', error)
    res.status(500).json({ error: 'Failed to analyze chat' })
  }
})

app.post('/api/instagram/send', async (req, res) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  
  try {
    const { threadId, message } = req.body
    if (!threadId || !message) {
      return res.status(400).json({ error: 'Thread ID and message required' })
    }
    
    const url = new URL(`https://graph.facebook.com/v18.0/${threadId}/messages`)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { text: message },
        access_token: auth.account.accessToken
      }),
      signal: AbortSignal.timeout(15000)
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      console.error('Send message failed:', data)
      return res.status(500).json({ error: 'Failed to send message' })
    }
    
    res.setHeader('Cache-Control', 'no-store')
    res.json({ success: true, messageId: data.message_id })
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

app.post('/api/instagram/cleanup', (req, res) => {
  const sessionId = getSessionId(req)
  if (sessionId) {
    const session = sessions.get(sessionId)
    if (session) {
      delete session.conversations
      delete session.activeThread
      delete session.chatData
      // Clear all cached data
      sessions.set(sessionId, { expiresAt: session.expiresAt }) // Keep session alive but clear data
    }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ success: true, message: 'Session data cleared' })
})

if (isProduction) {
  const distPath = path.join(root, 'dist')
  if (!existsSync(distPath)) throw new Error('Production assets not found. Run npm run build before npm start.')
  app.use(express.static(distPath, { index: false, maxAge: '1h' }))
  app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  app.use(vite.middlewares)
  app.use(async (req, res, next) => {
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, await readFile(path.join(root, 'index.html'), 'utf8'))
      res.status(200).type('html').send(html)
    } catch (error) {
      vite.ssrFixStacktrace(error)
      next(error)
    }
  })
}

app.listen(port, () => console.log(`SoulSync server listening on http://localhost:${port}`))
