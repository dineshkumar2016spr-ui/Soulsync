import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const root = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 5175
const isProduction = process.env.NODE_ENV === 'production'
const appId = process.env.INSTAGRAM_APP_ID
const appSecret = process.env.INSTAGRAM_APP_SECRET
const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `http://localhost:${port}/api/instagram/callback`
const scopes = ['instagram_business_basic', 'instagram_business_manage_messages']
const cookieName = 'muse_oauth_session'
const sessionTtlMs = 60 * 24 * 60 * 60 * 1000
const oauthStateTtlMs = 10 * 60 * 1000
const sessions = new Map()
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

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
  if (existing) return existing
  const id = randomBytes(32).toString('base64url')
  sessions.set(id, { expiresAt: Date.now() + sessionTtlMs })
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

app.disable('x-powered-by')
app.set('trust proxy', isProduction ? 1 : false)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

app.get('/api/instagram/status', (req, res) => {
  const sessionId = getSessionId(req)
  const account = sessionId ? sessions.get(sessionId)?.instagramAccount : null
  res.setHeader('Cache-Control', 'no-store')
  res.json({ configured: Boolean(appId && appSecret), connected: Boolean(account), account: account ? { username: account.username, accountType: account.accountType } : null })
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
    }
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json({ connected: false })
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

app.listen(port, () => console.log(`Muse server listening on http://localhost:${port}`))
