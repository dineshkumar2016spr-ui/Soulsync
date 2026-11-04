// SOULSYNC center panel: the real conversation with an original compact timeline
import { useEffect, useMemo, useRef, useState, type DragEvent, type UIEvent } from 'react'
import { api, dayLabel, timeShort, uploadWithProgress } from '../lib/api'
import type { Chat, Message } from '../lib/types'
import { Avatar, EmptyState, Icon, LoadingState } from './ui'
import { MediaViewer } from './MediaViewer'

const MAX_FILE = 10 * 1024 * 1024 // mirrors the server's 10 MB cap

export function ChatPanel({
  chat, messages, hasOlder, loadingOlder, onLoadOlder, onSend, onRemoveChat, relationship, onOpenCopilot,
  syncing, dragging, onDragEnter, onDragLeave, onMediaSent,
}: {
  chat: Chat | null
  messages: Message[]
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onSend: (text: string) => Promise<boolean>
  onRemoveChat: (chatId: string) => void
  relationship: string | null
  onOpenCopilot: () => void
  syncing: boolean
  dragging: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onMediaSent: () => void
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [pendingMedia, setPendingMedia] = useState<{ kind: 'image' | 'video'; url: string; name: string; type: string } | null>(null)
  const pendingFile = useRef<File | null>(null)
  const [caption, setCaption] = useState('')
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [viewer, setViewer] = useState<Message | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottom = useRef(true)
  const photoInput = useRef<HTMLInputElement | null>(null)
  const videoInput = useRef<HTMLInputElement | null>(null)

  const renderList = messages.length > 240 ? messages.slice(-240) : messages

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !stickToBottom.current) return
    node.scrollTop = node.scrollHeight
  }, [messages.length, chat?.id])

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    const node = e.currentTarget
    stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90
    if (node.scrollTop < 60 && hasOlder && !loadingOlder) onLoadOlder()
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending || !chat) return
    setSending(true)
    setComposerError(null)
    const ok = await onSend(text)
    setSending(false)
    if (ok) {
      setDraft('')
      stickToBottom.current = true
    } else {
      setComposerError('⚠ Message not sent. Check the connection and try again.')
    }
  }

  function chooseFile(kind: 'image' | 'video', input: HTMLInputElement | null) {
    const file = input?.files?.[0] ?? null
    if (!file) return
    if (file.size > MAX_FILE) {
      setComposerError('File too large — SOULSYNC supports up to 10 MB.')
      return
    }
    const isImage = file.type.startsWith('image/')
    if (kind === 'image' && !isImage) { setComposerError('That file is not a valid image.'); return }
    if (kind === 'video' && !file.type.startsWith('video/')) { setComposerError('That file is not a valid video.'); return }
    pendingFile.current = file
    setPendingMedia({ kind, url: URL.createObjectURL(file), name: file.name, type: file.type })
    setCaption('')
    setComposerError(null)
  }

  function replaceMedia(kind: 'image' | 'video') {
    const input = kind === 'image' ? photoInput.current : videoInput.current
    input?.click()
  }

  async function confirmMediaSend() {
    const pending = pendingMedia
    const file = pendingFile.current
    if (!pending || !file || !chat) return
    setPendingMedia(null)
    setUploadPct(0)
    setComposerError(null)
    try {
      const dataBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Could not read the file.'))
        reader.readAsDataURL(file)
      })
      await uploadWithProgress(
        '/api/whatsapp/send-media',
        { chatId: chat.id, kind: pending.kind, data: dataBase64, mime: file.type, caption: caption.trim() || undefined },
        (f) => setUploadPct(f),
      )
      setUploadPct(null)
      pendingFile.current = null
      onMediaSent()
      stickToBottom.current = true
    } catch (err) {
      setUploadPct(null)
      const message = err instanceof Error ? err.message : 'Upload failed.'
      setComposerError(`⚠ Upload failed — ${message}`)
      // restore preview so the user can retry or give up
      setPendingMedia(pending)
      setCaption(caption)
    }
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    onDragLeave()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const input = { files: e.dataTransfer.files as unknown as FileList } as HTMLInputElement
    chooseFile(file.type.startsWith('image/') ? 'image' : 'video', input)
  }

  const groups = useMemo(() => groupByDay(renderList), [renderList])

  if (!chat) {
    return (
      <section className="panel-center">
        <div className="center-blank">
          <EmptyState
            icon="message"
            title="No conversation selected"
            body="Choose a conversation on the left, or connect a new one from your WhatsApp."
          />
        </div>
      </section>
    )
  }

  const mediaCount = messages.filter((m) => m.hasMedia).length

  return (
    <section
      className={`panel-center ${dragging ? 'drag-over' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter() }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={drop}
      onDragLeave={onDragLeave}
    >
      <header className="chat-head">
        <Avatar name={chat.name} size={38} />
        <div className="chat-title">
          <strong>{chat.name}</strong>
          <span className="chat-sub">
            {relationship ? `${relationship} · ` : ''}
            {mediaCount > 0 ? `${messages.length} messages · ${mediaCount} media` : `${messages.length} messages`}
          </span>
        </div>
        <div className="chat-actions">
          <button className="chip-privacy" onClick={() => onRemoveChat(chat.id)} title="This conversation's access & privacy">
            <Icon name="lock" size={14} /> Private conversation
          </button>
          <button className="icon-btn mobile-only" onClick={onOpenCopilot} aria-label="Open AI Copilot"><Icon name="spark" /></button>
        </div>
      </header>

      <div className="msg-scroll" ref={scrollRef} onScroll={handleScroll}>
        {loadingOlder && <LoadingState label="Loading earlier messages…" />}
        {hasOlder && !loadingOlder && messages.length > 0 && (
          <div className="older-hint"><button onClick={onLoadOlder}>Load earlier messages</button></div>
        )}
        {!hasOlder && messages.length > 0 && <p className="history-note">This is the beginning of the synced conversation.</p>}

        {messages.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No messages synchronized yet"
            body="When messages arrive here from WhatsApp they appear automatically. You can also send the first one below."
          />
        ) : (
          groups.map(([day, items]) => (
            <div key={day} className="msg-day">
              <div className="day-sep"><span>{day}</span></div>
              {items.map((m) => <Bubble key={m.id} m={m} chat={chat} onOpen={setViewer} />)}
            </div>
          ))
        )}
      </div>

      <footer className="composer">
        {composerError && (
          <p className="composer-error">
            <Icon name="alert" size={13} /> {composerError}
            <button onClick={() => setComposerError(null)}>Dismiss</button>
          </p>
        )}
        {uploadPct !== null && (
          <div className="upload-progress">
            {uploadPct < 1 ? <>Uploading {pendingMedia?.kind === 'video' ? 'video' : 'photo'}… {Math.round(uploadPct * 100)}%</> : <>✓ Ready to send — finalizing</>}
            <div className="bar"><span style={{ width: `${Math.min(100, Math.round(uploadPct * 100))}%` }} /></div>
          </div>
        )}
        {pendingMedia && (
          <div className="media-preview-card">
            <div className="mp-thumb">
              {pendingMedia.kind === 'image'
                ? <img src={pendingMedia.url} alt="Preview" />
                : <video src={pendingMedia.url} muted playsInline />}
            </div>
            <div className="mp-meta">
              <strong>{pendingMedia.kind === 'image' ? 'Photo' : 'Video'}</strong>
              <span>{pendingMedia.name}</span>
              <div className="mp-actions">
                <button onClick={() => { setPendingMedia(null); pendingFile.current = null; setCaption('') }}>
                  <Icon name="close" size={13} /> Cancel
                </button>
                <button onClick={() => { setPendingMedia(null); pendingFile.current = null; replaceMedia(pendingMedia.kind) }}>
                  <Icon name="refresh" size={13} /> Replace
                </button>
              </div>
            </div>
            <div className="mp-caption">
              <input
                placeholder="Add a caption (optional)…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <button className="btn primary sm" onClick={() => void confirmMediaSend()}><Icon name="send" size={14} /> Send</button>
            </div>
          </div>
        )}
        {!pendingMedia && (
          <div className="composer-row">
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { chooseFile('image', e.currentTarget); e.currentTarget.value = '' }} />
            <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { chooseFile('video', e.currentTarget); e.currentTarget.value = '' }} />
            <button className="icon-btn attach" onClick={() => replaceMedia('image')} title="Photo" aria-label="Attach photo"><Icon name="image" /></button>
            <button className="icon-btn attach" onClick={() => replaceMedia('video')} title="Video" aria-label="Attach video"><Icon name="video" /></button>
            <textarea
              placeholder={syncing ? 'Reconnecting to WhatsApp…' : 'Write a message…'}
              value={draft}
              disabled={syncing}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button className="send-btn" onClick={() => void send()} disabled={!draft.trim() || sending || syncing} aria-label="Send">
              {sending ? <Icon name="clock" size={16} /> : <Icon name="send" size={16} />}
            </button>
          </div>
        )}
        <p className="composer-note">You control what is sent. SOULSYNC never sends without your action.</p>
      </footer>

      {viewer && <MediaViewer message={viewer} chatId={chat.id} onClose={() => setViewer(null)} />}
    </section>
  )
}

function Bubble({ m, chat, onOpen }: { m: Message; chat: Chat; onOpen: (m: Message) => void }) {
  const isMedia = m.hasMedia
  const kindLabel: string | null =
    m.kind === 'sticker' ? 'Sticker'
    : m.kind === 'audio' ? 'Voice message'
    : m.kind === 'document' ? 'Document'
    : null

  const mediaUrl = api.mediaUrl(chat.id, m.id)

  if (kindLabel && !isMedia) {
    return (
      <div className={`msg ${m.fromMe ? 'out' : 'in'}`}>
        <div className="bubble system">{kindLabel}{m.text && m.text !== kindLabel && m.text !== `🎙 ${kindLabel}` ? ` · ${m.text}` : ''}</div>
        <time>{timeShort(m.timestamp)}</time>
      </div>
    )
  }

  return (
    <div className={`msg ${m.fromMe ? 'out' : 'in'}`}>
      <div className="bubble">
        {isMedia && (
          <button className="bubble-media" onClick={() => onOpen(m)} aria-label={m.caption || 'Open media'}>
            {!isMedia || <MediaBubble mediaUrl={mediaUrl} isVideo={m.kind.startsWith('video')} alt={m.caption || 'Photo'} />}
          </button>
        )}
        {isMedia && m.caption ? <p className="caption">{m.caption}</p> : null}
        {!isMedia && <p>{m.text}</p>}
        <span className="msg-foot">
          <time>{timeShort(m.timestamp)}</time>
          {m.fromMe && <StatusIcon status={m.status} />}
        </span>
      </div>
    </div>
  )
}

function MediaBubble({ mediaUrl, isVideo, alt }: { mediaUrl: string; isVideo: boolean; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span className="media-missing"><Icon name="alert" size={16} /> Media unavailable in this session</span>
  }
  return isVideo
    ? <video src={mediaUrl} muted playsInline onError={() => setFailed(true)} />
    : <img src={mediaUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

export function StatusIcon({ status }: { status: Message['status'] }) {
  const num = typeof status === 'number' ? status : 1
  if (num >= 3) return <span className="status read"><Icon name="doubleCheck" size={13} /></span>
  if (num >= 2) return <span className="status"><Icon name="doubleCheck" size={13} /></span>
  return <span className="status"><Icon name="check" size={13} /></span>
}

export function groupByDay(messages: Message[]): [string, Message[]][] {
  const groups = new Map<string, Message[]>()
  for (const m of messages) {
    const label = dayLabel(m.timestamp)
    const arr = groups.get(label)
    if (arr) arr.push(m)
    else groups.set(label, [m])
  }
  return [...groups.entries()]
}
