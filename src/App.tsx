import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './App.css'

type Contact = {
  id: string
  name: string
  handle: string
  initials: string
  tone: string
  preview: string
  time: string
  channel: string
}

type Message = {
  id: string
  from: 'them' | 'you'
  text: string
  time: string
}

type ChatReport = {
  score: number
  title: string
  summary: string
  signals: { label: string; value: string; detail: string }[]
}

type Filter = 'all' | 'unread' | 'starred'
type InstagramStatus = { configured: boolean; connected: boolean; account: { username: string; accountType: string } | null }

const contacts: Contact[] = [
  { id: 'maya', name: 'Maya Chen', handle: '@mayachen', initials: 'MC', tone: 'rose', preview: 'That little bookstore sounds perfect ☕', time: '2m', channel: 'Instagram' },
  { id: 'leo', name: 'Leo Martins', handle: '@leomartins', initials: 'LM', tone: 'blue', preview: 'Sent you the playlist!', time: '18m', channel: 'Instagram' },
  { id: 'jules', name: 'Jules Rivera', handle: '@jules.rivera', initials: 'JR', tone: 'gold', preview: 'Are you going to the gallery opening?', time: '1h', channel: 'Instagram' },
  { id: 'sam', name: 'Sam Okafor', handle: '@samokafor', initials: 'SO', tone: 'green', preview: 'You: Saturday works for me', time: '3h', channel: 'Instagram' },
  { id: 'ella', name: 'Ella Brooks', handle: '@ellabrooks', initials: 'EB', tone: 'lavender', preview: 'Haha, I knew you would get it', time: 'Yesterday', channel: 'Instagram' },
]

const startingMessages: Record<string, Message[]> = {
  maya: [
    { id: 'm1', from: 'them', text: 'Okay, important question: are you a coffee-shop-with-a-book person or a coffee-shop-and-people-watch person?', time: '10:21' },
    { id: 'm2', from: 'you', text: 'A little of both, depending on the book and the people 😄', time: '10:23' },
    { id: 'm3', from: 'them', text: 'That is a very diplomatic answer. What have you been reading lately?', time: '10:25' },
    { id: 'm4', from: 'you', text: 'Just started a short story collection. I keep meaning to read more fiction.', time: '10:28' },
    { id: 'm5', from: 'them', text: 'I love short stories! There’s a tiny bookstore café near me that has the best chai. Have you been?', time: '10:31' },
    { id: 'm6', from: 'you', text: 'Not yet, but you’re making a pretty convincing case for it', time: '10:34' },
    { id: 'm7', from: 'them', text: 'That little bookstore sounds perfect ☕', time: '10:36' },
  ],
  leo: [
    { id: 'l1', from: 'them', text: 'You mentioned you were making a running playlist, right?', time: '09:42' },
    { id: 'l2', from: 'you', text: 'Yes! I need something that gets me through the last mile.', time: '09:48' },
    { id: 'l3', from: 'them', text: 'Sent you the playlist!', time: '10:05' },
  ],
  jules: [
    { id: 'j1', from: 'them', text: 'The new gallery on Mercer is opening Friday. The artist does these amazing paper sculptures.', time: '09:10' },
    { id: 'j2', from: 'you', text: 'That sounds right up my street. I love an opening night.', time: '09:17' },
    { id: 'j3', from: 'them', text: 'Are you going to the gallery opening?', time: '09:20' },
  ],
  sam: [
    { id: 's1', from: 'them', text: 'I found a good spot for that weekend hike we talked about.', time: 'Yesterday' },
    { id: 's2', from: 'you', text: 'Saturday works for me', time: 'Yesterday' },
  ],
  ella: [
    { id: 'e1', from: 'you', text: 'I still think the best movie snacks are a mix of sweet and salty.', time: 'Yesterday' },
    { id: 'e2', from: 'them', text: 'Haha, I knew you would get it', time: 'Yesterday' },
  ],
}

type SessionSnapshot = {
  selectedId: string
  intent: string
  messagesByContact: Record<string, Message[]>
}

function readSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem('muse-active-chat')
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<SessionSnapshot>
    if (typeof value.selectedId !== 'string' || !contacts.some((contact) => contact.id === value.selectedId)) return null
    if (typeof value.intent !== 'string' || !intents.includes(value.intent)) return null
    if (!value.messagesByContact || typeof value.messagesByContact !== 'object') return null
    return value as SessionSnapshot
  } catch {
    return null
  }
}

const intents = ['Serious love', 'Open relationship', 'Situationship', 'Casual dating', 'Friendship first', 'Still figuring it out']
const suggestions: Record<string, string> = {
  'Serious love': 'I’d love to check it out with you. What’s your favorite thing to order there?',
  'Open relationship': 'I’m into exploring that together. What does a great first visit look like to you?',
  Situationship: 'You’ve sold me on the chai 😊 When do you usually go?',
  'Casual dating': 'That sounds fun. I’m always up for finding a new café — when should we go?',
  'Friendship first': 'That sounds like such a good spot. I’d be up for checking it out as friends!',
  'Still figuring it out': 'That sounds lovely. I’d be happy to see how the conversation goes over chai ☕',
}

const iconPaths: Record<string, ReactNode> = {
  inbox: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 13h5l2 3h4l2-3h5" /></>,
  sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  send: <><path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z" /><path d="M9.7 13.3 14 9" /></>,
  heart: <path d="M20.8 8.7c0 5.1-8.8 10.3-8.8 10.3S3.2 13.8 3.2 8.7A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.5Z" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.3c-1 1.3-2.2 1.4-2.2 3.2M12 17h.01" /></>,
}

function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

function Avatar({ contact, size = 'regular', online = false }: { contact: Contact; size?: 'small' | 'regular' | 'large'; online?: boolean }) {
  return <span className={`avatar avatar-${contact.tone} avatar-${size}`} aria-label={contact.name}>{contact.initials}{online && <i className="online-dot" />}</span>
}

function createReport(messages: Message[], contact: Contact, intent: string): ChatReport {
  const theirs = messages.filter((message) => message.from === 'them')
  const ours = messages.filter((message) => message.from === 'you')
  const questions = theirs.filter((message) => message.text.includes('?')).length
  const warmWords = /love|great|perfect|fun|haha|😊|☕|excited|looking forward/i
  const warmCount = theirs.filter((message) => warmWords.test(message.text)).length
  const total = Math.max(theirs.length + ours.length, 1)
  const balance = Math.min(theirs.length, ours.length) / Math.max(theirs.length, ours.length, 1)
  const score = Math.max(35, Math.min(94, Math.round(42 + questions * 6 + warmCount * 5 + balance * 18)))
  const title = score >= 72 ? 'Promising mutual energy' : score >= 55 ? 'A warm start' : 'Still getting a read'
  const summary = questions > 1
    ? `${contact.name.split(' ')[0]} is showing curiosity by asking follow-up questions. There’s a friendly tone here; keep the conversation mutual and see whether that interest continues.`
    : `${contact.name.split(' ')[0]} is engaging, though there are only a few clear signals so far. Give the conversation room to develop instead of reading too much into one exchange.`

  return {
    score,
    title,
    summary: `${summary} Your stated intention is “${intent}”—use it as a guide for what feels good to you, not a script you have to follow.`,
    signals: [
      { label: 'Curiosity', value: questions > 1 ? 'High' : questions === 1 ? 'Some' : 'Early', detail: `${questions} ${questions === 1 ? 'question' : 'questions'} from them in this chat` },
      { label: 'Warmth', value: warmCount > 1 ? 'Warm' : warmCount === 1 ? 'Friendly' : 'Neutral', detail: 'Tone and positive language in their messages' },
      { label: 'Conversation balance', value: balance > 0.7 ? 'Mutual' : 'Uneven so far', detail: `${Math.round((theirs.length / total) * 100)}% of messages came from them` },
    ],
  }
}

function readOAuthResultToast(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('instagram_connected') === '1') return 'Instagram account connected securely'
    if (params.has('instagram_error')) return 'Instagram connection did not complete. Please try again.'
  } catch {
    // Ignore malformed query strings; there is simply no result toast to show.
  }
  return ''
}

function App() {
  const [sessionSnapshot] = useState(readSessionSnapshot)
  const [selectedId, setSelectedId] = useState(() => sessionSnapshot?.selectedId ?? 'maya')
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false)
  const [intent, setIntent] = useState(() => sessionSnapshot?.intent ?? 'Serious love')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [starred, setStarred] = useState<Set<string>>(() => new Set(['maya', 'jules']))
  const [unread, setUnread] = useState<Set<string>>(() => new Set(['maya', 'leo', 'jules']))
  const [messagesByContact, setMessagesByContact] = useState<Record<string, Message[]>>(() => sessionSnapshot?.messagesByContact ?? startingMessages)
  const [draft, setDraft] = useState('')
  const [ended, setEnded] = useState(false)
  const [report, setReport] = useState<ChatReport | null>(null)
  const [toast, setToast] = useState(readOAuthResultToast)
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus>({ configured: false, connected: false, account: null })
  const [instagramBusy, setInstagramBusy] = useState(false)

  const selected = contacts.find((contact) => contact.id === selectedId) ?? contacts[0]
  const messages = messagesByContact[selectedId] ?? []
  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const matchesSearch = `${contact.name} ${contact.handle}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'unread' ? unread.has(contact.id) : starred.has(contact.id))
    return matchesSearch && matchesFilter
  }), [filter, search, starred, unread])
  const unreadCount = unread.size
  const suggestion = suggestions[intent] ?? suggestions['Still figuring it out']

  useEffect(() => {
    let cancelled = false
    fetch('/api/instagram/status', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load Instagram connection status.')
        return await response.json() as InstagramStatus
      })
      .then((status) => { if (!cancelled) setInstagramStatus(status) })
      .catch(() => { if (!cancelled) setInstagramStatus({ configured: false, connected: false, account: null }) })

    const params = new URLSearchParams(window.location.search)
    if (params.has('instagram_connected') || params.has('instagram_error')) {
      window.history.replaceState({}, document.title, window.location.pathname)
      window.setTimeout(() => setToast(''), 4400)
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (ended) return
    try {
      window.sessionStorage.setItem('muse-active-chat', JSON.stringify({ selectedId, intent, messagesByContact }))
    } catch {
      // Storage can be unavailable in private browsing; the in-memory chat still works.
    }
  }, [ended, intent, messagesByContact, selectedId])

  function connectInstagram() {
    if (!instagramStatus.configured) {
      setToast('Instagram Login needs setup: set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET and INSTAGRAM_REDIRECT_URI on the server.')
      window.setTimeout(() => setToast(''), 5200)
      return
    }
    setInstagramBusy(true)
    window.location.assign('/api/instagram/login')
  }

  async function disconnectInstagram() {
    setInstagramBusy(true)
    try {
      const response = await fetch('/api/instagram/disconnect', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('Disconnect request failed.')
      setInstagramStatus((current) => ({ ...current, connected: false, account: null }))
      setToast('Instagram disconnected from this session')
    } catch {
      setToast('Could not disconnect Instagram. Please try again.')
    } finally {
      setInstagramBusy(false)
      window.setTimeout(() => setToast(''), 3000)
    }
  }

  function selectContact(contact: Contact) {
    setSelectedId(contact.id)
    setMobileInboxOpen(false)
    setUnread((current) => {
      const next = new Set(current)
      next.delete(contact.id)
      return next
    })
    setDraft('')
    setEnded(false)
    setReport(null)
  }

  function handleApprove() {
    const text = draft.trim()
    if (!text || ended) return
    const nextMessage: Message = { id: `you-${Date.now()}`, from: 'you', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setMessagesByContact((current) => ({ ...current, [selectedId]: [...(current[selectedId] ?? []), nextMessage] }))
    setDraft('')
    setToast('Approved · added to this demo conversation')
    window.setTimeout(() => setToast(''), 2600)
  }

  function handleEndChat() {
    const finalReport = createReport(messages, selected, intent)
    try {
      window.sessionStorage.clear()
    } catch {
      // Continue to the report even if browser storage is unavailable.
    }
    setMessagesByContact({})
    setReport(finalReport)
    setEnded(true)
    setDraft('')
  }

  function startNewChat() {
    setMessagesByContact((current) => ({ ...current, [selectedId]: [] }))
    setDraft('')
    setReport(null)
    setEnded(false)
  }

  function toggleStar(contactId: string) {
    setStarred((current) => {
      const next = new Set(current)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail" aria-label="Main navigation">
        <a className="brand-mark" href="#inbox" aria-label="Muse home"><span className="brand-glyph">m</span></a>
        <div className="rail-links">
          <button className="rail-link active" aria-label="Inbox"><Icon name="inbox" size={20} /><span className="rail-tooltip">Inbox</span></button>
          <button className="rail-link" aria-label="Coaching"><Icon name="sparkle" size={20} /><span className="rail-tooltip">Coaching</span></button>
        </div>
        <div className="rail-bottom">
          <span className="mini-avatar">D</span>
        </div>
      </aside>

      <main className="workspace" id="inbox">
        <header className="topbar">
          <div className="wordmark">muse<span>.</span></div>
          <div className="topbar-context"><span className="topbar-divider" />Your conversation space</div>
          <div className="topbar-right"><span className="privacy-pill"><Icon name="lock" size={13} /> Private by design</span><button className="profile-button" aria-label="Your profile"><span className="profile-avatar">D</span><span className="profile-name">Dinesh</span><span className="chevron">⌄</span></button></div>
        </header>

        <div className={`app-layout ${mobileInboxOpen ? 'mobile-inbox-open' : ''}`}>
          <section className="inbox-panel" aria-label="Social inbox">
            <div className="inbox-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>Inbox <span className="count-pill">{unreadCount}</span></h1></div><button className="icon-button" aria-label="Inbox options"><Icon name="more" /></button></div>
            <div className={`social-account ${instagramStatus.connected ? 'instagram-connected' : ''}`}><span className="instagram-mark"><Icon name="instagram" size={17} /></span><div className="social-label"><strong>{instagramStatus.connected && instagramStatus.account ? `@${instagramStatus.account.username}` : 'Instagram'}</strong><small>{instagramStatus.connected && instagramStatus.account ? `${instagramStatus.account.accountType.toLowerCase()} account connected` : 'Business or Creator account'}</small></div>{instagramStatus.connected ? <><span className="connected-dot" /><button type="button" className="instagram-connect-button disconnect-instagram-button" onClick={disconnectInstagram} disabled={instagramBusy}>Disconnect</button></> : <button type="button" className="instagram-connect-button" onClick={connectInstagram} disabled={instagramBusy}>{instagramBusy ? 'Opening…' : 'Connect'}</button>}</div>
            <label className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /><kbd>⌘ K</kbd></label>
            <div className="filter-tabs" role="tablist" aria-label="Filter conversations">
              {(['all', 'unread', 'starred'] as Filter[]).map((value) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'filter-tab selected' : 'filter-tab'} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'unread' ? 'Unread' : 'Starred'}{value === 'unread' && unreadCount > 0 && <span className="tab-count">{unreadCount}</span>}</button>)}
            </div>
            <div className="contact-list">
              {visibleContacts.length ? visibleContacts.map((contact) => (
                <div key={contact.id} className={`contact-row ${selectedId === contact.id ? 'is-selected' : ''}`} role="button" tabIndex={0} aria-pressed={selectedId === contact.id} onClick={() => selectContact(contact)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectContact(contact) } }}>
                  <span className="contact-avatar-wrap"><Avatar contact={contact} online={contact.id === 'maya'} />{unread.has(contact.id) && <i className="unread-dot" />}</span>
                  <span className="contact-copy"><span className="contact-name-line"><strong>{contact.name}</strong><time>{contact.time}</time></span><span className="contact-preview">{contact.preview}</span><span className="contact-channel"><Icon name="instagram" size={11} /> Instagram</span></span>
                  <button type="button" className={`star-toggle ${starred.has(contact.id) ? 'is-starred' : ''}`} aria-label={starred.has(contact.id) ? `Unstar ${contact.name}` : `Star ${contact.name}`} aria-pressed={starred.has(contact.id)} onClick={(event) => { event.stopPropagation(); toggleStar(contact.id) }}>✦</button>
                </div>
              )) : <div className="empty-contacts"><span>Nothing here just yet</span><small>Try a different search or filter.</small></div>}
            </div>
            <div className="inbox-footer"><span className="footer-status-dot" />Demo inbox · no messages are sent to Instagram            </div>
          </section>
          {mobileInboxOpen && <button className="mobile-inbox-scrim" onClick={() => setMobileInboxOpen(false)} aria-label="Close inbox overlay" />}

          <section className="chat-panel" aria-label={`Conversation with ${selected.name}`}>

            <header className="chat-header">
              <button className="mobile-inbox-toggle" onClick={() => setMobileInboxOpen((open) => !open)} aria-label={mobileInboxOpen ? 'Close inbox' : 'Open inbox'}><Icon name={mobileInboxOpen ? 'close' : 'inbox'} size={18} /></button>
              <div className="chat-person"><Avatar contact={selected} online /><div><h2>{selected.name}<span className="verified-mark">✓</span></h2><p>{selected.handle} <span className="handle-separator">·</span> active now</p></div></div>
              <div className="chat-header-actions"><span className="channel-chip"><Icon name="instagram" size={13} /> Instagram</span><button className="icon-button" aria-label="More conversation options"><Icon name="more" /></button></div>
            </header>

            {ended && report ? (
              <div className="report-view">
                <div className="report-kicker"><span className="report-sparkle"><Icon name="sparkle" size={17} /></span> POST-CHAT REFLECTION</div>
                <div className="report-title-row"><div><p className="eyebrow">A gentle read on the conversation</p><h2>Interest analysis</h2></div><button className="close-report" onClick={() => { setReport(null); setEnded(false) }} aria-label="Close report"><Icon name="close" /></button></div>
                <div className="interest-card"><div className="interest-score"><span>{report.score}</span><small>/ 100</small><div className="score-track"><i style={{ width: `${report.score}%` }} /></div></div><div className="interest-copy"><span className="signal-tag"><i /> CONVERSATION SIGNALS</span><h3>{report.title}</h3><p>{report.summary}</p></div></div>
                <div className="signals-heading"><div><h3>What stood out</h3><p>Patterns from this conversation, not a prediction.</p></div><span className="intent-summary"><Icon name="heart" size={14} /> {intent}</span></div>
                <div className="signal-grid">{report.signals.map((signal, index) => <article className="signal-card" key={signal.label}><span className={`signal-icon signal-icon-${index}`}><Icon name={index === 0 ? 'question' : index === 1 ? 'heart' : 'inbox'} size={17} /></span><p>{signal.label}</p><strong>{signal.value}</strong><small>{signal.detail}</small></article>)}</div>
                <div className="report-note"><Icon name="sparkle" size={16} /><p>This is a lightweight reflection on message patterns—not a way to know what someone is thinking. The clearest signal is always an honest conversation.</p></div>
                <button className="new-chat-button" onClick={startNewChat}>Start a fresh conversation <Icon name="arrow" size={17} /></button>
              </div>
            ) : (
              <>
                <div className="chat-scroll" aria-live="polite">
                  <div className="chat-date"><span />TODAY<span /></div>
                  <div className="chat-intro"><div className="intro-avatar"><Avatar contact={selected} size="large" /></div><strong>You matched with {selected.name.split(' ')[0]} ✨</strong><span>Let’s keep it curious and be yourself.</span></div>
                  {messages.map((message, index) => <div className={`message-row ${message.from === 'you' ? 'message-outgoing' : ''}`} key={message.id}>{message.from === 'them' && <Avatar contact={selected} size="small" />}<div className="message-content"><div className={`message-bubble ${message.from === 'you' ? 'bubble-outgoing' : 'bubble-incoming'}`}>{message.text}</div><time>{message.time}{message.from === 'you' && index === messages.length - 1 && <span className="read-check"> · ✓✓</span>}</time></div></div>)}
                  {messages.length === 0 && <div className="conversation-empty"><span className="empty-chat-icon"><Icon name="sparkle" size={20} /></span><strong>A fresh start</strong><p>Your next message is yours to shape. Use the coach for a little inspiration, then approve only what feels like you.</p></div>}
                </div>
                <div className="composer-wrap">
                  <div className="composer-hint"><span className="coach-live-dot" /> YOUR MESSAGE, YOUR CALL <span className="hint-spacer" /><Icon name="lock" size={12} /> Draft stays in this session</div>
                  <div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleApprove() }} placeholder="Write a reply in your own voice…" rows={2} aria-label="Edit your message draft" /><div className="composer-actions"><span className="keyboard-hint">⌘ ↵ to approve</span><button className="approve-button" onClick={handleApprove} disabled={!draft.trim()}><Icon name="check" size={16} /> Approve & send</button></div></div>
                  <div className="composer-bottom"><span>Nothing sends until you approve it.</span><button className="end-chat-button" onClick={handleEndChat}><Icon name="close" size={14} /> End chat</button></div>
                </div>
              </>
            )}
          </section>

          <aside className="coach-panel" aria-label="Conversation coaching">
            <div className="coach-heading"><div className="coach-icon"><Icon name="sparkle" size={18} /></div><div><p className="eyebrow">YOUR WINGMATE</p><h2>Chat coach</h2></div><span className="coach-ready"><i /> READY</span></div>
            <div className="intent-card"><div className="card-label"><span>YOUR INTENTION</span><Icon name="heart" size={15} /></div><p>What are you open to?</p><select value={intent} onChange={(event) => setIntent(event.target.value)} aria-label="Select your dating intention">{intents.map((item) => <option key={item}>{item}</option>)}</select><small>Your intention helps shape suggestions. You can change it anytime.</small></div>
            <div className="coach-divider"><span>IN THIS MOMENT</span></div>
            <div className="coach-observation"><span className="observation-icon"><Icon name="sparkle" size={16} /></span><div><strong>A nice opening</strong><p>{messages.filter((message) => message.from === 'them').length > 1 ? `${selected.name.split(' ')[0]} is keeping the conversation going. Pick up on something specific they shared to make your reply feel personal.` : `A new conversation is a chance to show a little curiosity. Keep it easy and let your personality come through.`}</p></div></div>
            <div className="coach-prompt-card"><div className="prompt-topline"><span><Icon name="send" size={13} /> A THOUGHTFUL REPLY</span><span className="prompt-sparkle">✦</span></div><p>“{suggestion}”</p><button onClick={() => { setDraft(suggestion); setToast('Suggestion added to your editable draft'); window.setTimeout(() => setToast(''), 2400) }}>Use as a starting point <Icon name="arrow" size={14} /></button></div>
            <div className="coach-values"><div><span className="value-icon"><Icon name="heart" size={15} /></span><p><strong>Stay true to you</strong><small>Suggestions are inspiration, never a script.</small></p></div><div><span className="value-icon"><Icon name="lock" size={15} /></span><p><strong>Your privacy matters</strong><small>End chat clears session storage.</small></p></div></div>
            <div className="coach-disclaimer"><Icon name="sparkle" size={13} /> Coaching preview · thoughtful, not a mind reader</div>
          </aside>
        </div>
        {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}
      </main>
    </div>
  )
}

export default App
