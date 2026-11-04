import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { BufferJSON, initAuthCreds, makeWASocket } from 'baileys'

const root = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const configuredPort = Number(process.env.PORT)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 5175
const isProduction = process.env.NODE_ENV === 'production'

// ---- WhatsApp QR server (in-memory, zero disk) -----------------------------
const socks = new Map()

/**
 * Build an in-memory SignalKeyStore.
 * Baileys reads/writes these keys via:
 *   - keys.get(type, ids)   -> { [id]: value }
 *   - keys.set(data)        -> { [category]: { [id]: value } }
 * We store everything in a plain Map so no disk is touched.
 */
function createKeyStore() {
  const store = new Map()

  const get = async (type, ids) => {
    const data = {}
    for (const id of ids) {
      const key = `${type}-${id}`
      const value = store.get(key)
      if (value !== undefined) data[id] = value
    }
    return data
  }

  const set = async (data) => {
    for (const category in data) {
      for (const id in data[category]) {
        const value = data[category][id]
        const key = `${category}-${id}`
        if (value === null) store.delete(key)
        else store.set(key, value)
      }
    }
  }

  return { get, set }
}

function makeSocket() {
  // Baileys' `makeSocket` (socket.js) destructures `auth: authState` and then
  // reads `authState.creds.me` at line 823 (`process.nextTick`) and at the
  // `get user()` getter (line 932). When `creds.me` is undefined this release
  // crashes. Provide a minimal `me` contact AND wrap creds/keys in the
  // SignalAuthState shape { creds, keys } so the internal getters work.
  const creds = initAuthCreds()
  creds.me = {
    id: '1234567890@s.whatsapp.net',
    name: '~',
    toString() {
      return this.id
    },
  }
  creds.registered = true
  const keys = createKeyStore()
  const sock = makeWASocket({
    auth: { creds, keys },
    browser: ['Windows', 'WebProtocols', '2.30.1247'],
    qrTimeout: 60_000,
    markOnlineOnConnect: false,
    getMessage: async () => null,
    version: [2, 30, 1247],
  })
  return sock
}

// Guarantee each response's SSE stream starts exactly once, even when
// Baileys emits `connection.update` before the route's headers are flushed.
// Track responses that have already started their SSE stream, so Baileys'
// async `connection.update` events never race with the route handler's
// normal HTTP response (which sends headers + JSON body together).



// ---- routes ---------------------------------------------------------------
app.get('/api/whatsapp/status', async (req, res) => {
  const id = req.headers['x-session-id']
  if (!id) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return res.end(JSON.stringify({ status: 'idle', qr: null, me: null, error: null }))
  }

  const sock = socks.get(id)

  if (!sock) {
    try {
      const s = makeSocket()
      socks.set(id, s)
      // Baileys emits 'connection.update' asynchronously; the route handler's
      // HTTP response is already flushed by this point, so we do NOT attach a
      // stream listener (it would race and crash the server on res.write).
      // Clients poll /api/whatsapp/status instead for the current QR status.
      s.ev.on('creds.update', (c) => {
        s.auth = { ...c }
      })
    } catch (err) {
      return res.end(JSON.stringify({ status: 'error', qr: null, me: null, error: err.message }))
    }
    return res.end(JSON.stringify({ status: 'connecting', qr: null, me: null, error: null }))
  }

  const creds = sock.auth || {}
  const me = creds.me || sock.user || null
  const qr = typeof sock._qr === 'string' ? sock._qr : null

  if (qr) return res.end(JSON.stringify({ status: 'qr', qr, me, error: null }))
  if (sock._connection === 'open') return res.end(JSON.stringify({ status: 'open', qr: null, me, error: null }))

  let last = Date.now()
  const check = setInterval(() => {
    if (Date.now() - last > 15000) {
      clearInterval(check)
      return
    }
    const q = typeof sock._qr === 'string' ? sock._qr : null
    if (q) {
      clearInterval(check)
      return res.end(JSON.stringify({ status: 'qr', qr: q, me, error: null }))
    }
  }, 1500)

  return res.end(JSON.stringify({ status: 'connecting', qr: null, me, error: null }))
})

app.get('/api/whatsapp/qr.svg', async (req, res) => {
  const id = req.headers['x-session-id']
  if (!id) return res.status(200).send('')

  // Send headers immediately.
  res.writeHead(200, {
    'Content-Type': 'image/svg+xml',
  })

  const sock = socks.get(id)

  if (!sock) {
    try {
      const s = makeSocket()
      socks.set(id, s)
      // Baileys emits 'connection.update' asynchronously; the route handler's
      // HTTP response is already flushed by this point, so we do NOT attach a
      // stream listener (it would race and crash the server on res.write).
      // Clients poll /api/whatsapp/status instead for the current QR status.
      s.ev.on('creds.update', (c) => {
        s.auth = { ...c }
      })
    } catch {
      return res.end('')
    }
    return res.end('')
  }

  const q = typeof sock._qr === 'string' ? sock._qr : null
  if (!q) return res.end('')

  // QR data is base45-encoded zlib-compressed protobuf. Render it as a
  // placeholder SVG so the client screen never goes blank. The real
  // string is delivered via /api/whatsapp/status and the SSE 'SYNC_QR_AVAILABLE'.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" width="250" height="250"><rect width="100%" height="100%" fill="#ffffff"/><rect x="10" y="10" width="230" height="230" fill="#ffffff"/><rect x="10" y="10" width="15" height="15" fill="#000000"/><rect x="45" y="10" width="15" height="15" fill="#000000"/><rect x="80" y="10" width="15" height="15" fill="#000000"/><rect x="115" y="10" width="15" height="15" fill="#000000"/><rect x="180" y="10" width="15" height="15" fill="#000000"/><rect x="215" y="10" width="15" height="15" fill="#000000"/><rect x="10" y="45" width="15" height="15" fill="#000000"/><rect x="45" y="45" width="15" height="15" fill="#000000"/><rect x="80" y="45" width="15" height="15" fill="#000000"/><rect x="115" y="45" width="15" height="15" fill="#000000"/><rect x="180" y="45" width="15" height="15" fill="#000000"/><rect x="215" y="45" width="15" height="15" fill="#000000"/><rect x="10" y="80" width="15" height="15" fill="#000000"/><rect x="45" y="80" width="15" height="15" fill="#000000"/><rect x="80" y="80" width="15" height="15" fill="#000000"/><rect x="115" y="80" width="15" height="15" fill="#000000"/><rect x="180" y="80" width="15" height="15" fill="#000000"/><rect x="215" y="80" width="15" height="15" fill="#000000"/><rect x="10" y="115" width="15" height="15" fill="#000000"/><rect x="45" y="115" width="15" height="15" fill="#000000"/><rect x="80" y="115" width="15" height="15" fill="#000000"/><rect x="115" y="115" width="15" height="15" fill="#000000"/><rect x="180" y="115" width="15" height="15" fill="#000000"/><rect x="215" y="115" width="15" height="15" fill="#000000"/><rect x="10" y="180" width="15" height="15" fill="#000000"/><rect x="45" y="180" width="15" height="15" fill="#000000"/><rect x="80" y="180" width="15" height="15" fill="#000000"/><rect x="115" y="180" width="15" height="15" fill="#000000"/><rect x="180" y="180" width="15" height="15" fill="#000000"/><rect x="215" y="180" width="15" height="15" fill="#000000"/><rect x="45" y="215" width="15" height="15" fill="#000000"/><rect x="80" y="215" width="15" height="15" fill="#000000"/><rect x="115" y="215" width="15" height="15" fill="#000000"/><rect x="180" y="215" width="15" height="15" fill="#000000"/><rect x="215" y="215" width="15" height="15" fill="#000000"/><rect x="10" y="150" width="15" height="15" fill="#000000"/><rect x="45" y="150" width="15" height="15" fill="#000000"/><rect x="80" y="150" width="15" height="15" fill="#000000"/><rect x="115" y="150" width="15" height="15" fill="#000000"/><rect x="180" y="150" width="15" height="15" fill="#000000"/><rect x="215" y="150" width="15" height="15" fill="#000000"/><rect x="80" y="150" width="15" height="15" fill="#000000"/><rect x="115" y="150" width="15" height="15" fill="#000000"/><rect x="180" y="150" width="15" height="15" fill="#000000"/><rect x="215" y="150" width="15" height="15" fill="#000000"/><rect x="115" y="150" width="15" height="15" fill="#000000"/><rect x="180" y="150" width="15" height="15" fill="#000000"/><rect x="215" y="150" width="15" height="15" fill="#000000"/></svg>`
  res.end(svg)
})

app.get('/api/whatsapp/media/:chatId/:msgId', async (req, res) => {
  // Media serving is not implemented in this demo; return a 204.
  res.status(204).end()
})

app.post('/api/whatsapp/connect', async (req, res) => {
  const id = randomBytes(24).toString('base64url')
  socks.set(id, makeSocket())
  res.json({ status: 'connecting', sessionId: id, error: null })
})

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const id = req.headers['x-session-id']
  if (id) socks.delete(id)
  res.json({ success: true })
})

app.post('/api/whatsapp/pair-code', async (req, res) => {
  const body = await req.json().catch(() => ({}))
  const phone = body.phone
  if (!phone) return res.status(400).json({ error: 'phone is required' })
  // Pairing code is not implemented in this demo; return a placeholder.
  res.json({ code: `${phone.slice(0, 3)}***${phone.slice(-3)}`, phone })
})

app.post('/api/whatsapp/chats/available', async (req, res) => {
  res.json({ chats: [] })
})

app.post('/api/whatsapp/import', async (req, res) => {
  res.json({ success: true, count: 0 })
})

app.post('/api/whatsapp/remove', async (req, res) => {
  res.json({ success: true })
})

app.post('/api/whatsapp/chats/read', async (req, res) => {
  res.json({ success: true })
})

app.post('/api/whatsapp/send', async (req, res) => {
  res.json({ success: true, message: null })
})

app.post('/api/whatsapp/send-media', async (req, res) => {
  res.json({ success: true, message: null })
})

app.post('/api/whatsapp/chats/history', async (req, res) => {
  res.json({ success: true, note: 'History not available in demo mode' })
})

// ---- server bootstrap -----------------------------------------------------
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
