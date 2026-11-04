// SOULSYNC shared primitives: icons, logo, avatar, sync indicator, states
import type { ReactNode } from 'react'

export const ICONS: Record<string, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  send: <><path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z" /><path d="M9.7 13.3 14 9" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m3.5 18 5.5-5 4 3.5 3-2.5 4.5 4" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-2.8v8.6l-5-2.8" /></>,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>,
  sticker: <><path d="M4 11.9A8 8 0 0 1 12.1 4 8 8 0 0 1 20 12a8 8 0 0 1-8 8H6.2A2.2 2.2 0 0 1 4 17.8Z" /><path d="M15 20v-4h4" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  doubleCheck: <><path d="m2.5 12.5 4 4L15 8" /><path d="m9.5 16.5 8-8" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></>,
  alert: <><path d="M12 4 2.8 20h18.4Z" /><path d="M12 10.5v4M12 17.6h.01" /></>,
  refresh: <><path d="M20 11.5a8 8 0 1 1-2.34-6.13" /><path d="M20 3.8v4.2h-4.2" /></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 5.5v-1h-11v11h1.2" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10.5" rx="2.2" /><path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" /></>,
  shield: <><path d="M12 3.5 5 6v5.5c0 4.6 3 8.1 7 9.5 4-1.4 7-4.9 7-9.5V6Z" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5v-1a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1M6.5 6.5 7.5 20h9l1-13.5" /></>,
  whatsapp: <><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3a8.5 8.5 0 1 1 15.6-4.5Z" /><path d="M8.9 8.3c.2-.5.5-.5.7-.5h.5c.2 0 .4 0 .6.4l.7 1.7c.1.2 0 .4-.1.6l-.5.5c-.2.2-.2.4-.1.6.4.7 1.2 1.5 1.9 1.8.2.1.4.1.6-.1l.5-.5c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .4-.1 1.2-.6 1.6-.5.4-1.2.7-2 .5-2.4-.4-4.6-2.7-5.1-5-.2-.8.1-1.5.5-1.9Z" /></>,
  arrowBack: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowFwd: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  inbox: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 13h5l2 3h4l2-3h5" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5L16.5 11" /><path d="M5 19.5h14" /></>,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  pause: <><path d="M7.5 5v14M16.5 5v14" /></>,
  fullscreen: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  edit: <><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  message: <><path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L4 20.5l1-4.4A8.5 8.5 0 1 1 21 12Z" /></>,
  file: <><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" /><path d="M13 3v6h6" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  link: <><path d="M9.5 14.5a4 4 0 0 1 0-5.7l3.4-3.4a4 4 0 0 1 5.7 5.7l-1.7 1.7" /><path d="M14.5 9.5a4 4 0 0 1 0 5.7l-3.4 3.4a4 4 0 0 1-5.7-5.7l1.7-1.7" /></>,
  heart: <><path d="M12 20.5s-8-5.2-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 3.1c0 5.2-8 10.4-8 10.4Z" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
}

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] ?? null}
    </svg>
  )
}

/** The SOULSYNC mark: two synchronized strands meeting in a subtle heart */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="SOULSYNC logo">
      <defs>
        <linearGradient id="ssMark" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ef8d9a" />
          <stop offset="0.55" stopColor="#d06487" />
          <stop offset="1" stopColor="#9a6be0" />
        </linearGradient>
      </defs>
      <path
        d="M32 46 C22 39.5 15.5 32.6 15.5 25.4 C15.5 19.6 19.9 15.4 25.2 15.4 C28.1 15.4 30.6 16.7 32 18.9 C33.4 16.7 35.9 15.4 38.8 15.4 C44.1 15.4 48.5 19.6 48.5 25.4 C48.5 32.6 42 39.5 32 46 Z"
        fill="none" stroke="url(#ssMark)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"
      />
      <circle cx="32" cy="26.5" r="3.3" fill="#ef8d9a" />
      <circle cx="25" cy="26.5" r="1.8" fill="#d06487" />
      <circle cx="39" cy="26.5" r="1.8" fill="#9a6be0" />
      <path d="M26.8 26.5H23.6M37.2 26.5h3.2" stroke="url(#ssMark)" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  )
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="wordmark">
      S<span className="wordmark-thin">OUL</span>SYNC
      {!compact && <em className="wordmark-claim">Understand the conversation. Choose the right words.</em>}
    </span>
  )
}

const AVATAR_TONES = ['rose', 'violet', 'amber', 'teal', 'slate']

export function Avatar({ name, seed = 0, size = 40 }: { name: string; seed?: number; size?: number }) {
  const tone = AVATAR_TONES[seed % AVATAR_TONES.length]
  const clean = name.replace(/^\+/, '').split(/[\s._-]+/).filter(Boolean)
  const chars = clean.map((p) => p[0]).join('')
  const label = (chars.length > 0 ? chars.slice(0, 2) : name.slice(0, 2) || 'SO').toUpperCase()
  return (
    <span className={`avatar t-${tone}`} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }} aria-hidden="true">
      {label}
    </span>
  )
}

/* ---------- sync indicator ---------- */
export type SyncState = 'connected' | 'syncing' | 'reconnecting' | 'offline'

export function SyncDot({ state }: { state: SyncState }) {
  return <span className={`sync-dot ${state}`} aria-hidden="true" />
}

export function SyncIndicator({ state, lastSyncAt }: { state: SyncState; lastSyncAt: number | null }) {
  const labels: Record<SyncState, string> = {
    connected: 'Connected',
    syncing: 'Syncing',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
  }
  const ago = lastSyncAt ? `· Last synced ${formatAgo(lastSyncAt)}` : ''
  return (
    <span className="sync-indicator">
      <SyncDot state={state} /> {labels[state]} {ago && <span className="sync-ago">{ago}</span>}
    </span>
  )
}

export function formatAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
  return `${Math.round(m / 60)}h ago`
}

/* ---------- states ---------- */
export function EmptyState({ icon = 'spark', title, body, action }: { icon?: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="state-block empty">
      <span className="state-icon"><Icon name={icon} size={22} /></span>
      <h4>{title}</h4>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function ErrorState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="state-block error">
      <span className="state-icon alert"><Icon name="alert" size={22} /></span>
      <h4>{title}</h4>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state-block loading">
      <div className="loading-orbs"><i /><i /><i /></div>
      <p>{label}</p>
    </div>
  )
}

/* ---------- modal scaffold ---------- */
export function Modal({ title, onClose, children, wide = false, footer }: {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
  footer?: ReactNode
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        {title && (
          <header className="modal-head">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}
