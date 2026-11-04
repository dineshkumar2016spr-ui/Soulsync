// SOULSYNC onboarding: welcome → WhatsApp consent → QR link → conversation access → done
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Me, SyncStatus } from '../lib/types'
import { EmptyState, Icon, LoadingState, LogoMark, Modal, Wordmark } from './ui'

const CONSENT_BULLET = [
  ['What we access', 'Only this linked WhatsApp connection and the conversations you explicitly select. Nothing is imported by default.'],
  ['Why we need it', 'SOULSYNC syncs text, photos and videos in those conversations so the copilot can help you understand them and draft replies.'],
  ['AI processing', 'Message content from connected conversations can be processed by the selected AI provider — but only after you allow AI analysis, which is off by default.'],
  ['Media', 'Images and videos can be sent and received. AI media analysis is a separate, opt-in permission.'],
  ['How long we keep it', 'Everything lives in your session’s memory for this visit only. Disconnecting, restarting or closing the session clears it.'],
  ['How to stop', 'Disconnect WhatsApp or remove any conversation at any time from the Privacy Center — instantly and completely.'],
]

export function Onboarding({ onWorkspace, onDisconnected }: { onWorkspace: () => void; onDisconnected: (me: Me | null) => void }) {
  const [step, setStep] = useState<'welcome' | 'consent' | 'qr' | 'picker' | 'linked'>('welcome')
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [me, setMe] = useState<Me>(null)
  const [understood, setUnderstood] = useState(false)
  const [pairPhone, setPairPhone] = useState('')
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [pairBusy, setPairBusy] = useState(false)
  const [pairError, setPairError] = useState<string | null>(null)

  // ---- QR / connect watch
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (step !== 'qr' && step !== 'linked') return
    const source = new EventSource('/api/events')
    source.addEventListener('SYNC_CONNECTED', () => {
      source.close()
      void loadMe().then(() => setStep('picker'))
    })
    // the instant a fresh QR is generated, swap it in — no polling delay, no flicker
    source.addEventListener('SYNC_QR_AVAILABLE', () => {
      api.qr().then((u) => { if (mounted.current) setQrDataUrl(u) }).catch(() => undefined)
    })
    source.onerror = () => { source.close() }
    return () => { source.close() }
  }, [step])

  const pollStatus = useCallback(async () => {
    try {
      const s = await api.whatsappStatus()
      if (!mounted.current) return
      setStatus(s.status)
      setError(s.error)
      setMe((prev) => s.me ?? prev)
      if (s.status === 'qr') {
        api.qr().then((u) => { if (mounted.current) setQrDataUrl(u) }).catch(() => undefined)
      }
      if (s.status === 'open') {
        setMe(s.me)
        setStep((cur) => (cur === 'qr' ? 'picker' : cur))
      }
    } catch { /* transient */ }
  }, [])

  useEffect(() => {
    if (step !== 'qr') return
    void pollStatus()
    const t = window.setInterval(pollStatus, 1500)
    return () => window.clearInterval(t)
  }, [step, pollStatus])

  async function loadMe() {
    try {
      const s = await api.whatsappStatus()
      if (s.me) setMe(s.me)
    } catch { /* ignore */ }
  }

  async function startConnect() {
    setConnecting(true)
    setError(null)
    try {
      await api.connectWhatsApp(true)
      setStep('qr')
      void pollStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the WhatsApp connection.')
    } finally {
      setConnecting(false)
    }
  }

  async function requestPair() {
    setPairBusy(true)
    setPairError(null)
    setPairCode(null)
    try {
      const { code } = await api.pairCode(pairPhone.trim())
      setPairCode(code)
    } catch (err) {
      setPairError(err instanceof Error ? err.message : 'Could not request a pairing code.')
    } finally {
      setPairBusy(false)
    }
  }

  if (step === 'welcome') {
    return (
      <div className="onboard">
        <div className="onboard-card welcome">
          <LogoMark size={78} />
          <h1 className="brand-big"><Wordmark /></h1>
          <p className="tagline">Better conversations. Deeper connections.</p>
          <p className="welcome-body">
            SOULSYNC is your private AI relationship copilot for the conversations that
            actually matter — helping you understand the context and choose your words well.
          </p>
          <button className="btn primary big" onClick={() => setStep('consent')}>
            Get Started <Icon name="arrowFwd" />
          </button>
        </div>
      </div>
    )
  }

  if (step === 'consent') {
    return (
      <div className="onboard">
        <div className="onboard-card">
          <header className="onboard-head">
            <LogoMark size={40} />
            <div>
              <h2>Connect your WhatsApp conversation</h2>
              <p className="onboard-sub">Here is exactly what SOULSYNC does with your data — no vague language.</p>
            </div>
          </header>
          <ul className="consent-list">
            {CONSENT_BULLET.map(([title, body]) => (
              <li key={title}><strong>{title}</strong><span>{body}</span></li>
            ))}
          </ul>
          <label className="checkline">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>I understand and I want to connect my WhatsApp to SOULSYNC.</span>
          </label>
          {error && <p className="inline-error"><Icon name="alert" size={14} /> {error}</p>}
          <div className="onboard-cta-row">
            <button className="btn ghost" onClick={() => setStep('welcome')}>Back</button>
            <button className="btn primary" disabled={!understood || connecting} onClick={() => void startConnect()}>
              {connecting ? 'Connecting…' : 'Connect WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'qr') {
    return (
      <div className="onboard">
        <div className="onboard-card qr-card wide">
          <header className="onboard-head center">
            <LogoMark size={40} />
            <div>
              <h2>Link your WhatsApp</h2>
              <p className="onboard-sub">
                Choose either method below to link your device.
              </p>
            </div>
          </header>
          <div className="link-methods">
            <div className="link-method">
              <h3>Option 1: Scan QR Code</h3>
              <p>On your phone, open WhatsApp → <strong>Settings → Linked devices → Link a device</strong>, then scan this code.</p>
              <div className="qr-frame">
                {qrDataUrl
                  ? <img src={qrDataUrl} alt="WhatsApp QR code" />
                  : <LoadingState label={status === 'connecting' ? 'Requesting a QR code from WhatsApp…' : 'Preparing the link…'} />}
              </div>
              <div className="qr-status">
                <span className={`sync-dot ${status === 'open' ? 'connected' : status === 'connecting' ? 'syncing' : status === 'error' ? 'offline' : 'connected'}`} />
                <span>{status === 'open' ? 'Linked. Syncing now…' : status === 'connecting' ? 'Getting a fresh code…' : status === 'error' ? 'QR expired' : 'Waiting for the scan — refreshes automatically'}</span>
              </div>
            </div>
            <div className="link-method-divider" />
            <div className="link-method">
              <h3>Option 2: Link with phone number</h3>
              <p>On your phone: WhatsApp → <strong>Settings → Linked devices → Link with phone number</strong>.</p>
              {!pairCode ? (
                <>
                  <div className="pair-row">
                    <input
                      placeholder="Enter phone number with country code (e.g., 1234567890)"
                      value={pairPhone}
                      inputMode="numeric"
                      onChange={(e) => setPairPhone(e.target.value)}
                    />
                    <button className="btn primary" disabled={pairBusy || pairPhone.trim().length < 7} onClick={() => void requestPair()}>
                      {pairBusy ? 'Requesting…' : 'Get pairing code'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="pair-code-hold">
                  <span className="pair-code">{pairCode}</span>
                  <p>Type this code in WhatsApp on your phone when prompted. The app will connect automatically.</p>
                </div>
              )}
              {pairError && <p className="inline-error"><Icon name="alert" size={13} /> {pairError}</p>}
            </div>
          </div>
          {error && <p className="inline-error"><Icon name="alert" size={14} /> {error}</p>}
          <div className="onboard-cta-row">
            <button className="btn ghost" onClick={() => setStep('consent')}>Back</button>
            {status === 'error' && (
              <button className="btn primary" onClick={() => void startConnect()}>Get a fresh QR code</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'picker') {
    return <ConversationPicker me={me} onDone={() => setStep('linked')} onDisconnect={async () => {
      setStep('consent')
    }} />
  }

  void onDisconnected
  return (
    <div className="onboard">
      <div className="onboard-card welcome">
        <LogoMark size={78} />
        <h1 className="brand-big"><Wordmark /></h1>
        <p className="tagline">You’re linked. Your workspace is ready.</p>
        <button className="btn primary big" onClick={onWorkspace}>Open SOULSYNC <Icon name="arrowFwd" /></button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ picker */
function ConversationPicker({ me, onDone, onDisconnect }: { me: Me | null; onDone: () => void; onDisconnect: () => void }) {
  const [chats, setChats] = useState<import('../lib/types').AvailableChat[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessModal, setAccessModal] = useState(null as string | null)

  const MAX = 25
  const refresh = useCallback(async () => {
    try {
      const { chats } = await api.availableChats()
      setChats(chats)
    } catch {
      setChats([])
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = window.setInterval(refresh, 4000)
    return () => window.clearInterval(t)
  }, [refresh])

  const filtered = (chats ?? []).filter((c) => `${c.name}`.toLowerCase().includes(query.trim().toLowerCase()))

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX) next.add(id)
      return next
    })
  }

  async function confirmAccess() {
    if (!accessModal) return
    setAccessModal(null)
    setImporting(true)
    setError(null)
    try {
      await api.importChats([...selected], true)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect the conversation.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="onboard">
      <div className="onboard-card picker-card">
        <header className="onboard-head">
          <LogoMark size={40} />
          <div>
            <h2>Choose your conversation</h2>
            <p className="onboard-sub">
              Select the conversations you want SOULSYNC to help you understand — up to {MAX}.
              {me?.number ? ` Linked as +${me.number}.` : ''} Nothing is imported automatically.
            </p>
          </div>
        </header>

        <div className="picker-bar">
          <label className="searchbox"><Icon name="search" size={15} />
            <input placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <span className="picker-count">{selected.size}/{MAX} selected</span>
        </div>

        <div className="picker-list">
          {chats === null ? (
            <LoadingState label="Reading your discovered conversations…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="message"
              title="No conversations discovered yet"
              body="Your phone is still syncing recent chats. If nothing appears within a minute, open WhatsApp on your phone once, then wait here."
              action={<div className="state-actions"><button className="btn ghost" onClick={onDisconnect}>Start over</button></div>}
            />
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                className={`pick-row ${selected.has(c.id) ? 'active' : ''}`}
                onClick={() => toggle(c.id)}
                type="button"
              >
                <span className="avatar t-rose" aria-hidden="true">
                  {(c.name || 'WA').replace(/^\+/, '').split(/[\s._-]+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'WA'}
                </span>
                <span className="pick-main">
                  <strong>{c.name}</strong>
                  <span className="pick-snip">{c.lastMessage || 'No recent messages visible'}</span>
                </span>
                <span className="pick-check">{selected.has(c.id) && <Icon name="check" size={15} />}</span>
              </button>
            ))
          )}
        </div>

        {error && <p className="inline-error"><Icon name="alert" size={14} /> {error}</p>}

        <div className="onboard-cta-row">
          <button className="btn ghost" onClick={onDisconnect}>Back</button>
          <button
            className="btn primary"
            disabled={selected.size === 0 || importing}
            onClick={() => setAccessModal('access')}
          >
            <Icon name="lock" size={15} /> {importing ? 'Connecting…' : 'Allow Access'}
          </button>
        </div>

        {accessModal && (
          <Modal
            title="Conversation Access"
            onClose={() => setAccessModal(null)}
            footer={
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setAccessModal(null)}>Cancel</button>
                <button className="btn primary" onClick={confirmAccess} disabled={importing}>
                  {importing ? 'Connecting…' : 'Allow Access'}
                </button>
              </div>
            }
          >
            <p>
              You are giving SOULSYNC access to <strong>{selected.size === 1 ? 'this selected conversation' : `these ${selected.size} selected conversations`}</strong> only —
              for the features you choose.
            </p>
            <ul className="access-types">
              <li><Icon name="check" size={14} /> Text messages</li>
              <li><Icon name="check" size={14} /> Photos</li>
              <li><Icon name="check" size={14} /> Videos</li>
            </ul>
            <p className="modal-note">You can remove any conversation later in the Privacy Center. Nothing else in your WhatsApp is read.</p>
          </Modal>
        )}
      </div>
    </div>
  )
}
