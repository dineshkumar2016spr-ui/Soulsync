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
// Facebook Graph version used for OAuth + Instagram messaging. Override with GRAPH_API_VERSION.
const graphVersion = process.env.GRAPH_API_VERSION || 'v21.0'
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
  if (!session?.instagramAccount?.pageAccessToken) {
    res.status(401).json({ error: 'Not connected to Instagram. Connect an Instagram Business account first.' })
    return null
  }
  return { sessionId, session, account: session.instagramAccount }
}

async function graphGet(pathname, params, timeoutMs = 15000) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${pathname.replace(/^\/+/, '')}`)
  url.search = new URLSearchParams(params).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

function metaError(payload, fallback) {
  const message = payload?.error?.message
  return typeof message === 'string' && message ? message : fallback
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
  res.json({
    configured: Boolean(appId && appSecret),
    connected: Boolean(account),
    account: account
      ? { username: account.username, accountType: account.accountType, userId: account.userId, pageName: account.pageName || '' }
      : null,
  })
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
  // Meta's OAuth dialog (Facebook Login for Business). This is what issues the
  // code we exchange for a user token, then a Page token we can read DMs with.
  const authorizationUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`)
  authorizationUrl.searchParams.set('client_id', appId)
  authorizationUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('scope', scopes.join(','))
  authorizationUrl.searchParams.set('state', state)
  res.setHeader('Cache-Control', 'no-store')
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
    const reason = req.query.error === 'access_denied' ? 'denied' : 'connection_failed'
    return res.redirect(`/?instagram_error=${reason}`)
  }
  if (!session || typeof returnedState !== 'string' || typeof savedState !== 'string' || typeof savedStateExpiresAt !== 'number' || savedStateExpiresAt < Date.now() || returnedState.length !== savedState.length || !timingSafeEqual(Buffer.from(returnedState), Buffer.from(savedState))) {
    return res.status(400).send('Instagram login could not be verified. Start the connection again.')
  }
  if (typeof req.query.code !== 'string' || req.query.code.length > 4096) {
    return res.status(400).send('Instagram did not return an authorization code.')
  }

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`)
    tokenUrl.search = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code: req.query.code,
    }).toString()
    const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(15000) })
    const shortLived = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || typeof shortLived.access_token !== 'string') {
      console.error('Facebook code exchange failed:', metaError(shortLived, 'unknown error'))
      return res.redirect('/?instagram_error=token_exchange_failed')
    }

    let userAccessToken = shortLived.access_token
    try {
      const longLivedUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`)
      longLivedUrl.search = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userAccessToken,
      }).toString()
      const longLivedResponse = await fetch(longLivedUrl, { signal: AbortSignal.timeout(15000) })
      const longLived = await longLivedResponse.json().catch(() => ({}))
      if (longLivedResponse.ok && typeof longLived.access_token === 'string') userAccessToken = longLived.access_token
    } catch {
      // Keep the short-lived token so this visit still works.
    }

    // Resolve the Facebook Page this Instagram account is linked to. Page tokens
    // (not the user token) are what the Instagram messaging API accepts.
    const { response: pagesResponse, payload: pages } = await graphGet('me/accounts', {
      fields: 'id,name,access_token,instagram_business_account{id,username,account_type}',
      limit: '100',
      access_token: userAccessToken,
    })
    if (!pagesResponse.ok) {
      console.error('Facebook pages fetch failed:', metaError(pages, 'unknown error'))
      return res.redirect('/?instagram_error=pages_fetch_failed')
    }
    const pageList = Array.isArray(pages.data) ? pages.data : []
    if (pageList.length === 0) return res.redirect('/?instagram_error=no_pages')
    const page = pageList.find((item) => item?.instagram_business_account?.id && item?.access_token)
    if (!page) return res.redirect('/?instagram_error=no_instagram_account')

    const igAccount = page.instagram_business_account
    session.instagramAccount = {
      userId: String(igAccount.id),
      username: igAccount.username || page.name || 'instagram',
      accountType: String(igAccount.account_type || 'BUSINESS').toUpperCase(),
      pageId: String(page.id),
      pageName: page.name || '',
      pageAccessToken: page.access_token,
      userAccessToken,
      expiresAt: Date.now() + 55 * 24 * 60 * 60 * 1000,
    }
    delete session.conversations
    delete session.activeThread
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
    const baseParams = {
      platform: 'instagram',
      limit: '30',
      access_token: auth.account.pageAccessToken,
    }

    // `snippet` is not available on every Graph version, so fall back gracefully.
    let { response, payload } = await graphGet(`${auth.account.userId}/conversations`, {
      ...baseParams,
      fields: 'id,updated_time,snippet,participants',
    })
    if (!response.ok) {
      const first = await graphGet(`${auth.account.userId}/conversations`, {
        ...baseParams,
        fields: 'id,updated_time,participants',
      })
      response = first.response
      payload = first.payload
    }

    if (!response.ok) {
      console.error('Conversations fetch failed:', metaError(payload, 'unknown error'))
      return res.status(502).json({
        conversations: [],
        error: metaError(payload, 'Meta rejected the conversation request.'),
        hint: 'The Instagram account must be a Business/Creator account linked to a Facebook Page you admin, and the app needs instagram_manage_messages approved.',
      })
    }

    const ownUsername = String(auth.account.username || '').toLowerCase()
    const conversations = (Array.isArray(payload.data) ? payload.data : []).map((conversation) => {
      const participants = Array.isArray(conversation.participants?.data) ? conversation.participants.data : []
      const other = participants.find((participant) => {
        if (String(participant?.id) === auth.account.userId) return false
        if (ownUsername && String(participant?.username || '').toLowerCase() === ownUsername) return false
        return true
      }) || participants[0] || {}
      return {
        id: String(conversation.id),
        name: other.name || (other.username ? `@${other.username}` : 'Instagram user'),
        username: other.username || '',
        participantId: other.id ? String(other.id) : '',
        snippet: typeof conversation.snippet === 'string' ? conversation.snippet : '',
        updatedTime: conversation.updated_time || '',
      }
    })

    auth.session.conversations = conversations
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ conversations, account: { username: auth.account.username, igUserId: auth.account.userId } })
  } catch (error) {
    console.error('Conversations fetch error:', error instanceof Error ? error.message : error)
    return res.status(500).json({ conversations: [], error: 'Failed to fetch conversations from Instagram.' })
  }
})

app.get('/api/instagram/messages/:threadId', async (req, res) => {
  const auth = requireAuth(req, res)
  if (!auth) return
  const threadId = String(req.params.threadId || '')
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(threadId)) {
    return res.status(400).json({ error: 'Invalid conversation id.' })
  }
  try {
    const { response, payload } = await graphGet(`${threadId}/messages`, {
      fields: 'id,message,from{id,username,name},created_time',
      limit: '20',
      access_token: auth.account.pageAccessToken,
    })

    if (!response.ok) {
      console.error('Messages fetch failed:', metaError(payload, 'unknown error'))
      return res.status(502).json({ error: metaError(payload, 'Meta rejected the message request.') })
    }

    const ownUsername = String(auth.account.username || '').toLowerCase()
    const messages = (Array.isArray(payload.data) ? payload.data : []).map((message) => {
      const sender = message.from || {}
      const fromMe = String(sender.id || '') === auth.account.userId
        || Boolean(ownUsername) && String(sender.username || '').toLowerCase() === ownUsername
      return {
        id: String(message.id),
        text: typeof message.message === 'string' ? message.message : '',
        fromMe,
        sender: { id: sender.id ? String(sender.id) : '', username: sender.username || '' },
        createdAt: message.created_time || '',
      }
    })

    // Newest first from Meta; the UI reads top-to-bottom.
    messages.reverse()
    auth.session.activeThread = { threadId, fetchedAt: Date.now(), count: messages.length }
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ threadId, messages })
  } catch (error) {
    console.error('Messages fetch error:', error instanceof Error ? error.message : error)
    return res.status(500).json({ error: 'Failed to fetch messages from Instagram.' })
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
    const { threadId, recipientId, message } = req.body || {}
    const text = typeof message === 'string' ? message.trim() : ''
    if (!text || text.length > 1000) {
      return res.status(400).json({ error: 'A message between 1 and 1000 characters is required.' })
    }

    // The Instagram messaging API needs the recipient's IGSID, not the thread id.
    let recipient = typeof recipientId === 'string' ? recipientId : ''
    if (!recipient && typeof threadId === 'string' && Array.isArray(auth.session.conversations)) {
      recipient = auth.session.conversations.find((conversation) => conversation.id === threadId)?.participantId || ''
    }
    if (!recipient) {
      return res.status(400).json({
        error: 'Missing recipient for this conversation. Reload the inbox so the participant id can be resolved.',
        hint: 'Instagram only allows sends to a participant id returned by the conversations edge.',
      })
    }

    const url = new URL(`https://graph.facebook.com/${graphVersion}/${auth.account.userId}/messages`)
    url.searchParams.set('access_token', auth.account.pageAccessToken)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipient },
        messaging_type: 'RESPONSE',
        message: { text },
      }),
      signal: AbortSignal.timeout(15000),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('Send message failed:', metaError(data, 'unknown error'))
      return res.status(502).json({
        error: metaError(data, 'Meta rejected the message send.'),
        hint: 'Instagram only permits replies within 24 hours of the last customer message.',
      })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.json({ success: true, messageId: data.message_id || null, recipientId: recipient })
  } catch (error) {
    console.error('Send message error:', error instanceof Error ? error.message : error)
    return res.status(500).json({ error: 'Failed to send message.' })
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
