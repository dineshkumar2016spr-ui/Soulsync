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
  threadId?: string
  participantId?: string
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
type InstagramStatus = { configured: boolean; connected: boolean; account: { username: string; accountType: string; userId?: string; pageName?: string } | null }

type ApiConversation = {
  id: string
  name?: string
  username?: string
  participantId?: string
  snippet?: string
  updatedTime?: string
}

type ApiMessage = { id: string; text?: string; fromMe?: boolean; createdAt?: string }

type ChatAnalysis = {
  match_interest_score: number
  psychology_analysis: string
  suggested_reply: string
  timing_advice: string
}

type UserCredits = {
  credits_remaining: number
  plan_type: 'free' | 'pro' | 'vip'
  accepted_terms_at?: string
}

const contacts: Contact[] = [
  { id: 'maya', name: 'Maya Chen', handle: '@mayachen', initials: 'MC', tone: 'rose', preview: 'That little bookstore sounds perfect ☕', time: '2m', channel: 'Instagram' },
  { id: 'leo', name: 'Leo Martins', handle: '@leomartins', initials: 'LM', tone: 'blue', preview: 'Sent you the playlist!', time: '18m', channel: 'Instagram' },
  { id: 'jules', name: 'Jules Rivera', handle: '@jules.rivera', initials: 'JR', tone: 'gold', preview: 'Are you going to the gallery opening?', time: '1h', channel: 'Instagram' },
  { id: 'sam', name: 'Sam Okafor', handle: '@samokafor', initials: 'SO', tone: 'green', preview: 'You: Saturday works for me', time: '3h', channel: 'Instagram' },
  { id: 'ella', name: 'Ella Brooks', handle: '@ellabrooks', initials: 'EB', tone: 'lavender', preview: 'Haha, I knew you would get it', time: 'Yesterday', channel: 'Instagram' },
]

const emptyContact: Contact = { id: '', name: 'No conversation yet', handle: '', initials: 'IG', tone: 'rose', preview: '', time: '', channel: 'Instagram' }

const intents = ['Serious love', 'Open relationship', 'Situationship', 'Casual dating', 'Friendship first', 'Still figuring it out']

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
  const questions = theirs.filter((message) => message.text?.includes('?')).length
  const warmWords = /love|great|perfect|fun|haha|😊|☕|excited|looking forward/i
  const warmCount = theirs.filter((message) => warmWords.test(message.text || '')).length
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

const oauthErrorMessages: Record<string, string> = {
  denied: 'Instagram login was cancelled before it finished.',
  token_exchange_failed: 'Meta rejected the login code. Check INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET.',
  pages_fetch_failed: 'Could not read your Facebook Pages. Confirm you granted pages_show_list.',
  no_pages: 'No Facebook Page found on this account. Link a Page to your Instagram professional account first.',
  no_instagram_account: 'That Page has no linked Instagram Business account. Convert the Instagram profile to a professional account and connect it to the Page.',
  connection_failed: 'Instagram connection did not complete. Please try again.',
}

function readOAuthResultToast(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('instagram_connected') === '1') return 'Instagram account connected securely'
    const error = params.get('instagram_error')
    if (error) return oauthErrorMessages[error] ?? oauthErrorMessages.connection_failed
  } catch {
    // Ignore malformed query strings
  }
  return ''
}

function App() {
  const [selectedId, setSelectedId] = useState('maya')
  const [mobileInboxOpen, setMobileInboxOpen] = useState(false)
  const [intent, setIntent] = useState('Serious love')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [starred, setStarred] = useState<Set<string>>(() => new Set(['maya', 'jules']))
  const [unread, setUnread] = useState<Set<string>>(() => new Set(['maya', 'leo', 'jules']))
  const [messagesByContact, setMessagesByContact] = useState<Record<string, Message[]>>({})
  const [draft, setDraft] = useState('')
  const [ended, setEnded] = useState(false)
  const [report, setReport] = useState<ChatReport | null>(null)
  const [toast, setToast] = useState(readOAuthResultToast)
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus>({ configured: false, connected: false, account: null })
  const [instagramBusy, setInstagramBusy] = useState(false)
  const [chatAnalysis, setChatAnalysis] = useState<ChatAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [sending, setSending] = useState(false)
  const [realContacts, setRealContacts] = useState<Contact[]>(contacts)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [ageConsent, setAgeConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [userCredits, setUserCredits] = useState<UserCredits>({ credits_remaining: 10, plan_type: 'free' })
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showMobileCoach] = useState(false)
  void showMobileCoach

  const selected = realContacts.find((contact) => contact.id === selectedId) ?? realContacts[0] ?? emptyContact
  const messages = messagesByContact[selectedId] ?? []
  const visibleContacts = useMemo(() => realContacts.filter((contact) => {
    const matchesSearch = `${contact.name} ${contact.handle}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'unread' ? unread.has(contact.id) : starred.has(contact.id))
    return matchesSearch && matchesFilter
  }), [filter, search, starred, unread, realContacts])
  const unreadCount = unread.size

  useEffect(() => {
    let cancelled = false
    fetch('/api/instagram/status', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load Instagram connection status.')
        return await response.json() as InstagramStatus
      })
      .then((status) => { if (!cancelled) setInstagramStatus(status) })
      .catch(() => { if (!cancelled) setInstagramStatus({ configured: false, connected: false, account: null }) })

    fetch('/api/user/credits', { credentials: 'same-origin' })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          return { credits_remaining: data.credits_remaining || 10, plan_type: (data.plan_type === 'pro' || data.plan_type === 'vip') ? data.plan_type : 'free' } as UserCredits
        }
        return { credits_remaining: 10, plan_type: 'free' } as UserCredits
      })
      .then((credits) => { if (!cancelled) setUserCredits(credits) })
      .catch(() => {})

    const params = new URLSearchParams(window.location.search)
    if (params.has('instagram_connected') || params.has('instagram_error')) {
      window.history.replaceState({}, document.title, window.location.pathname)
      window.setTimeout(() => setToast(''), 4400)
    }
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (instagramStatus.connected) {
      fetchConversations()
    }
  }, [instagramStatus.connected])

  function showToast(message: string, duration = 3600) {
    setToast(message)
    window.setTimeout(() => setToast(''), duration)
  }

  async function loadThreadMessages(contact: Contact) {
    if (!contact.threadId || !instagramStatus.connected) return
    try {
      const response = await fetch(`/api/instagram/messages/${encodeURIComponent(contact.threadId)}`, { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        showToast(typeof data.error === 'string' ? data.error : 'Could not load this conversation.', 5000)
        return
      }
      const loadedMessages: Message[] = (Array.isArray(data.messages) ? data.messages : []).map((message: ApiMessage) => ({
        id: message.id,
        from: message.fromMe ? 'you' : 'them',
        text: message.text || '',
        time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }))
      setMessagesByContact((current) => ({ ...current, [contact.id]: loadedMessages }))
    } catch (error) {
      console.error('Failed to load messages:', error)
      showToast('Could not load messages from Instagram.', 4000)
    }
  }

  async function fetchConversations() {
    setLoadingConversations(true)
    try {
      const response = await fetch('/api/instagram/conversations', { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRealContacts([])
        const message = typeof data.error === 'string' ? data.error : 'Could not load Instagram conversations.'
        const hint = typeof data.hint === 'string' ? ` ${data.hint}` : ''
        showToast(`${message}${hint}`, 6500)
        return
      }

      const tones = ['rose', 'blue', 'gold', 'green', 'lavender']
      const apiContacts: Contact[] = (Array.isArray(data.conversations) ? data.conversations : []).map((conversation: ApiConversation, index: number) => {
        const name = conversation.name || conversation.username || 'Instagram user'
        const initials = name.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'IG'
        return {
          id: conversation.id,
          name,
          handle: conversation.username ? `@${conversation.username}` : 'Instagram DM',
          initials,
          tone: tones[index % tones.length],
          preview: conversation.snippet || 'Open this chat to load messages',
          time: conversation.updatedTime ? new Date(conversation.updatedTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
          channel: 'Instagram',
          threadId: conversation.id,
          participantId: conversation.participantId || '',
        }
      })

      setRealContacts(apiContacts)
      setSelectedId((current) => (apiContacts.some((contact) => contact.id === current) ? current : apiContacts[0]?.id ?? ''))
      if (apiContacts.length > 0) void loadThreadMessages(apiContacts[0])
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
      setRealContacts([])
      showToast('Could not reach Instagram. Please try again.', 4000)
    } finally {
      setLoadingConversations(false)
    }
  }

  function connectInstagram() {
    if (!ageConsent || !termsConsent) {
      setToast('Please accept the age verification and Terms of Service to continue.')
      window.setTimeout(() => setToast(''), 3200)
      return
    }
    if (!instagramStatus.configured) {
      setToast('Instagram Login needs setup: set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET and INSTAGRAM_REDIRECT_URI on the server.')
      window.setTimeout(() => setToast(''), 5200)
      return
    }
    // Accept terms on backend
    fetch('/api/user/accept-terms', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
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

  async function selectContact(contact: Contact) {
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
    setChatAnalysis(null)
    
    await loadThreadMessages(contact)
  }

  async function analyzeChat() {
    if (messages.length === 0 || analyzing) return
    if (userCredits.credits_remaining <= 0 && userCredits.plan_type !== 'vip') {
      setShowPricingModal(true)
      setToast("You've used all free credits! Upgrade to continue.")
      window.setTimeout(() => setToast(''), 3200)
      return
    }
    setAnalyzing(true)
    try {
      const response = await fetch('/api/analyze-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ messages, goal: intent })
      })
      if (response.ok) {
        const analysis = await response.json() as ChatAnalysis
        setChatAnalysis(analysis)
        // Update credits
        if (userCredits.plan_type !== 'vip') {
          setUserCredits(prev => ({ ...prev, credits_remaining: Math.max(0, prev.credits_remaining - 1) }))
        }
        setToast('AI analysis complete')
        window.setTimeout(() => setToast(''), 2600)
      } else if (response.status === 402) {
        setShowPricingModal(true)
        setToast('Insufficient credits. Please upgrade your plan.')
        window.setTimeout(() => setToast(''), 3200)
      } else {
        setToast('Analysis failed. Please try again.')
        window.setTimeout(() => setToast(''), 2600)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setToast('Analysis failed. Please try again.')
      window.setTimeout(() => setToast(''), 2600)
    } finally {
      setAnalyzing(false)
    }
  }

  function useSuggestedReply() {
    if (chatAnalysis?.suggested_reply) {
      setDraft(chatAnalysis.suggested_reply)
      setToast('AI suggestion added to your draft')
      window.setTimeout(() => setToast(''), 2400)
    }
  }

  async function handleApprove() {
    const text = draft.trim()
    if (!text || ended) return
    setSending(true)
    
    try {
      const contact = selected
      if (contact.threadId && instagramStatus.connected) {
        const response = await fetch('/api/instagram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ threadId: contact.threadId, recipientId: contact.participantId, message: text })
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(typeof data.hint === 'string' ? data.hint : typeof data.error === 'string' ? data.error : 'Failed to send message')
        }
      }
      
      const nextMessage: Message = { id: `you-${Date.now()}`, from: 'you', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      setMessagesByContact((current) => ({ ...current, [selectedId]: [...(current[selectedId] ?? []), nextMessage] }))
      setDraft('')
      setToast('Message sent via Instagram')
      window.setTimeout(() => setToast(''), 2600)
    } catch (error) {
      console.error('Send error:', error)
      showToast(error instanceof Error ? error.message : 'Failed to send message', 5000)
    } finally {
      setSending(false)
    }
  }

  async function handleEndChat() {
    const finalReport = createReport(messages, selected, intent)
    try {
      window.sessionStorage.clear()
      await fetch('/api/instagram/cleanup', { method: 'POST', credentials: 'same-origin' })
    } catch {
      // Continue to the report even if cleanup fails
    }
    setMessagesByContact({})
    setReport(finalReport)
    setEnded(true)
    setDraft('')
    setChatAnalysis(null)
  }

  function startNewChat() {
    setMessagesByContact((current) => ({ ...current, [selectedId]: [] }))
    setDraft('')
    setReport(null)
    setEnded(false)
    setChatAnalysis(null)
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
        <a className="brand-mark" href="#inbox" aria-label="SoulSync home"><span className="brand-glyph">s</span></a>
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
          <div className="wordmark">soulsync<span>.</span></div>
          <div className="topbar-context"><span className="topbar-divider" />AI Dating & Communication Coach</div>
          <div className="topbar-right"><span className="privacy-pill"><Icon name="lock" size={13} /> Zero-retention privacy</span><button onClick={() => setShowPricingModal(true)} style={{display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: userCredits.plan_type === 'vip' ? '#fbbf24' : userCredits.plan_type === 'pro' ? '#a78bfa' : '#f3f4f6', color: userCredits.plan_type === 'free' ? '#374151' : 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600'}}><Icon name="sparkle" size={12} /> {userCredits.plan_type === 'vip' ? 'VIP' : userCredits.plan_type === 'pro' ? `Pro (${userCredits.credits_remaining})` : `Free (${userCredits.credits_remaining})`} </button><button className="profile-button" aria-label="Your profile"><span className="profile-avatar">D</span><span className="profile-name">Dinesh</span><span className="chevron">⌄</span></button></div>
        </header>

        <div className={`app-layout ${mobileInboxOpen ? 'mobile-inbox-open' : ''}`}>
          <section className="inbox-panel" aria-label="Social inbox">
            <div className="inbox-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>Inbox <span className="count-pill">{unreadCount}</span></h1></div><button className="icon-button" aria-label="Inbox options"><Icon name="more" /></button></div>
            <div className={`social-account ${instagramStatus.connected ? 'instagram-connected' : ''}`}><span className="instagram-mark"><Icon name="instagram" size={17} /></span><div className="social-label"><strong>{instagramStatus.connected && instagramStatus.account ? `@${instagramStatus.account.username}` : 'Instagram'}</strong><small>{instagramStatus.connected && instagramStatus.account ? `${instagramStatus.account.accountType.toLowerCase()} account connected` : 'Business or Creator account'}</small></div>{instagramStatus.connected ? <><span className="connected-dot" /><button type="button" className="instagram-connect-button disconnect-instagram-button" onClick={disconnectInstagram} disabled={instagramBusy}>Disconnect</button></> : <button type="button" className="instagram-connect-button" onClick={connectInstagram} disabled={instagramBusy || !ageConsent || !termsConsent}>{instagramBusy ? 'Opening…' : 'Connect'}</button>}</div>
            {!instagramStatus.connected && (
              <div style={{padding: '10px', background: '#fff7ed', borderRadius: '8px', marginBottom: '10px', border: '1px solid #fed7aa'}}>
                <div style={{fontSize: '11px', fontWeight: '600', color: '#ea580c', marginBottom: '6px'}}>Legal Consent Required</div>
                <label style={{display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '10px', color: '#9a3412', marginBottom: '4px', cursor: 'pointer'}}>
                  <input type="checkbox" checked={ageConsent} onChange={(e) => setAgeConsent(e.target.checked)} style={{marginTop: '2px'}} />
                  <span>I confirm that I am 18 years of age or older.</span>
                </label>
                <label style={{display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '10px', color: '#9a3412', cursor: 'pointer'}}>
                  <input type="checkbox" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} style={{marginTop: '2px'}} />
                  <span>I accept the Terms of Service and Privacy Policy.</span>
                </label>
                <div style={{fontSize: '9px', color: '#c2410c', marginTop: '4px', fontStyle: 'italic'}}>SoulSync complies with Zero-Data Retention policy. Chat contents are flushed upon ending session.</div>
              </div>
            )}
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
              )) : <div className="empty-contacts"><span>{loadingConversations ? 'Syncing your inbox…' : instagramStatus.connected ? 'No Instagram DMs yet' : 'Nothing here just yet'}</span><small>{instagramStatus.connected ? 'New Instagram conversations appear here automatically.' : 'Connect Instagram to see conversations.'}</small></div>}
            </div>
            <div className="inbox-footer"><span className="footer-status-dot" />{instagramStatus.connected ? (loadingConversations ? 'Syncing...' : 'Live from Instagram') : 'Demo mode'}</div>
            {instagramStatus.connected && <button type="button" className="refresh-inbox-button" onClick={() => void fetchConversations()} disabled={loadingConversations}>↻ Refresh inbox</button>}
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
                <div className="report-note"><Icon name="sparkle" size={16} /><p>This is a lightweight reflection on message patterns—not a way to know what someone is thinking. All data has been cleared for privacy.</p></div>
                <button className="new-chat-button" onClick={startNewChat}>Start a fresh conversation <Icon name="arrow" size={17} /></button>
              </div>
            ) : (
              <>
                <div className="chat-scroll" aria-live="polite">
                  <div className="chat-date"><span />TODAY<span /></div>
                  <div className="chat-intro"><div className="intro-avatar"><Avatar contact={selected} size="large" /></div><strong>You matched with {selected.name.split(' ')[0]} ✨</strong><span>Let’s keep it curious and be yourself.</span></div>
                  {messages.map((message, index) => <div className={`message-row ${message.from === 'you' ? 'message-outgoing' : ''}`} key={message.id}>{message.from === 'them' && <Avatar contact={selected} size="small" />}<div className="message-content"><div className={`message-bubble ${message.from === 'you' ? 'bubble-outgoing' : 'bubble-incoming'}`}>{message.text}</div><time>{message.time}{message.from === 'you' && index === messages.length - 1 && <span className="read-check"> · ✓✓</span>}</time></div></div>)}
                  {messages.length === 0 && <div className="conversation-empty"><span className="empty-chat-icon"><Icon name="sparkle" size={20} /></span><strong>A fresh start</strong><p>Your next message is yours to shape. Use the AI coach for psychology insights and suggested responses.</p></div>}
                </div>
                <div className="composer-wrap">
                  <div className="composer-hint"><span className="coach-live-dot" /> HUMAN-IN-THE-LOOP · APPROVE BEFORE SENDING <span className="hint-spacer" /><Icon name="lock" size={12} /> Zero-retention privacy</div>
                  <div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleApprove() }} placeholder="Write a reply in your own voice…" rows={2} aria-label="Edit your message draft" /><div className="composer-actions"><span className="keyboard-hint">⌘ ↵ to approve & send</span><button className="approve-button" onClick={handleApprove} disabled={!draft.trim() || sending}><Icon name="check" size={16} /> {sending ? 'Sending…' : 'Approve & Send'}</button></div></div>
                  <div className="composer-bottom"><span>Message only sent upon explicit approval.</span><button className="end-chat-button" onClick={handleEndChat}><Icon name="close" size={14} /> End Chat</button></div>
                </div>
              </>
            )}
          </section>

          <aside className="coach-panel" aria-label="Conversation coaching">
            <div className="coach-heading"><div className="coach-icon"><Icon name="sparkle" size={18} /></div><div><p className="eyebrow">AI PSYCHOLOGY COACH</p><h2>Chat Analysis</h2></div><span className="coach-ready"><i /> READY</span></div>
            <div className="intent-card"><div className="card-label"><span>RELATIONSHIP GOAL</span><Icon name="heart" size={15} /></div><p>What are you looking for?</p><select value={intent} onChange={(event) => setIntent(event.target.value)} aria-label="Select your dating intention">{intents.map((item) => <option key={item}>{item}</option>)}</select><small>Goal shapes AI analysis and suggestions.</small></div>
            <div className="coach-divider"><span>ANALYSIS</span></div>
            <button className="analyze-button" onClick={analyzeChat} disabled={messages.length === 0 || analyzing} style={{width: '100%', padding: '10px', marginBottom: '12px', background: analyzing ? '#d7c5cc' : '#b85d7b', color: 'white', border: 'none', borderRadius: '8px', cursor: messages.length === 0 || analyzing ? 'not-allowed' : 'pointer', fontWeight: '600'}}>
              {analyzing ? 'Analyzing...' : 'Analyze Chat Psychology'}
            </button>
            {chatAnalysis && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div style={{padding: '10px', background: '#fff0f4', borderRadius: '8px', border: '1px solid #f1dce4'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px'}}>
                    <strong style={{color: '#a6506d', fontSize: '11px'}}>Interest Score</strong>
                    <span style={{marginLeft: 'auto', fontWeight: '700', color: '#a6506d'}}>{chatAnalysis.match_interest_score}/100</span>
                  </div>
                  <div style={{height: '4px', background: '#f1e4e9', borderRadius: '2px', overflow: 'hidden'}}>
                    <div style={{height: '100%', background: '#b85d7b', width: `${chatAnalysis.match_interest_score}%`}} />
                  </div>
                </div>
                <div style={{padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #f0e9ed'}}>
                  <strong style={{color: '#59515a', fontSize: '10px', display: 'block', marginBottom: '4px'}}>Psychology Analysis</strong>
                  <p style={{margin: 0, color: '#8d858f', fontSize: '9px', lineHeight: '1.5'}}>{chatAnalysis.psychology_analysis}</p>
                </div>
                <div style={{padding: '10px', background: '#fff8fa', borderRadius: '8px', border: '1px solid #f1dce4'}}>
                  <strong style={{color: '#a6506d', fontSize: '10px', display: 'block', marginBottom: '4px'}}>AI Suggested Reply</strong>
                  <p style={{margin: '0 0 8px 0', color: '#625660', fontSize: '9px', lineHeight: '1.5', fontStyle: 'italic'}}>"{chatAnalysis.suggested_reply}"</p>
                  <button onClick={useSuggestedReply} style={{width: '100%', padding: '6px', background: 'white', color: '#a6506d', border: '1px solid #f1dce4', borderRadius: '6px', cursor: 'pointer', fontSize: '9px', fontWeight: '600'}}>Use This Suggestion</button>
                </div>
                <div style={{padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #f0e9ed'}}>
                  <strong style={{color: '#59515a', fontSize: '10px', display: 'block', marginBottom: '4px'}}>Timing Advice</strong>
                  <p style={{margin: 0, color: '#8d858f', fontSize: '9px', lineHeight: '1.5'}}>{chatAnalysis.timing_advice}</p>
                </div>
              </div>
            )}
            <div className="coach-values" style={{marginTop: 'auto'}}>
              <div><span className="value-icon"><Icon name="lock" size={15} /></span><p><strong>Zero Retention</strong><small>All data cleared on End Chat</small></p></div>
              <div><span className="value-icon"><Icon name="heart" size={15} /></span><p><strong>Human Approval</strong><small>Messages only sent on approval</small></p></div>
            </div>
          </aside>
        </div>
        {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}
        
        {showPricingModal && (
          <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}} onClick={() => setShowPricingModal(false)}>
            <div style={{background: 'white', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto', padding: '24px'}} onClick={(e) => e.stopPropagation()}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px'}}>
                <h2 style={{margin: 0, fontSize: '24px', fontWeight: '700'}}>Upgrade Your Plan</h2>
                <button onClick={() => setShowPricingModal(false)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px'}}><Icon name="close" size={24} /></button>
              </div>
              <p style={{color: '#666', marginBottom: '24px'}}>Choose the plan that fits your needs</p>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px'}}>
                <div style={{border: userCredits.plan_type === 'free' ? '2px solid #b85d7b' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', position: 'relative'}}>
                  {userCredits.plan_type === 'free' && <div style={{position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#b85d7b', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px'}}>Current</div>}
                  <h3 style={{margin: '10px 0 8px', fontSize: '18px'}}>Free Tier</h3>
                  <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '12px'}}>₹0<span style={{fontSize: '14px', fontWeight: '400'}}>/month</span></div>
                  <ul style={{listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '12px'}}>
                    <li style={{marginBottom: '6px'}}>✓ {userCredits.plan_type === 'free' ? userCredits.credits_remaining : 10} Chat Analyses</li>
                    <li style={{marginBottom: '6px'}}>✓ Basic Psychology Analysis</li>
                    <li style={{marginBottom: '6px'}}>✓ Limited Slang Suggestions</li>
                  </ul>
                </div>
                <div style={{border: userCredits.plan_type === 'pro' ? '2px solid #a78bfa' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', position: 'relative'}}>
                  {userCredits.plan_type === 'pro' && <div style={{position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#a78bfa', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px'}}>Current</div>}
                  <h3 style={{margin: '10px 0 8px', fontSize: '18px'}}>Pro Starter</h3>
                  <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '12px'}}>₹199<span style={{fontSize: '14px', fontWeight: '400'}}>/month</span></div>
                  <ul style={{listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '12px'}}>
                    <li style={{marginBottom: '6px'}}>✓ 150 Chat Analyses</li>
                    <li style={{marginBottom: '6px'}}>✓ Full Psychology Score</li>
                    <li style={{marginBottom: '6px'}}>✓ Custom Relationship Goals</li>
                    <li style={{marginBottom: '6px'}}>✓ Telugu Youth Slang Suggestions</li>
                  </ul>
                  <button style={{width: '100%', padding: '8px', background: '#a78bfa', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Upgrade to Pro</button>
                </div>
                <div style={{border: userCredits.plan_type === 'vip' ? '2px solid #fbbf24' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', position: 'relative'}}>
                  {userCredits.plan_type === 'vip' && <div style={{position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fbbf24', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px'}}>Current</div>}
                  <h3 style={{margin: '10px 0 8px', fontSize: '18px'}}>Unlimited VIP</h3>
                  <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '12px'}}>₹499<span style={{fontSize: '14px', fontWeight: '400'}}>/month</span></div>
                  <ul style={{listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '12px'}}>
                    <li style={{marginBottom: '6px'}}>✓ Unlimited Analyses</li>
                    <li style={{marginBottom: '6px'}}>✓ Real-time Auto-Suggest</li>
                    <li style={{marginBottom: '6px'}}>✓ Priority Speed</li>
                    <li style={{marginBottom: '6px'}}>✓ Full Privacy Mode</li>
                  </ul>
                  <button style={{width: '100%', padding: '8px', background: '#fbbf24', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}>Upgrade to VIP</button>
                </div>
              </div>
              <p style={{fontSize: '11px', color: '#666', marginTop: '16px', textAlign: 'center'}}>Payment integration coming soon. Contact support for upgrades.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


export default App
