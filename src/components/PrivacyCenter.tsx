// SOULSYNC Privacy Center: consent status, connected conversations, AI/media toggles, data deletion
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Chat, ConsentRecord, PrivacySettings } from '../lib/types'
import { Icon, Modal, formatAgo } from './ui'

export function PrivacyCenter({ open, onClose, privacy, consents, chats, sse }: {
  open: boolean
  onClose: () => void
  privacy: PrivacySettings
  consents: ConsentRecord[]
  chats: Chat[]
  sse: string | null
}) {
  const [conversationList, setConversationList] = useState<Chat[]>(chats)
  const [confirm, setConfirm] = useState<null | { scope: 'conversation' | 'ai' | 'media' | 'all' }>(null)
  const [disconnectMode, setDisconnectMode] = useState<null | 'only' | 'all'>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setConversationList(chats)
  }, [chats, open])

  if (!open) return null

  async function setSetting(kind: 'aiProcessing' | 'mediaAnalysis', value: boolean) {
    setBusy(true)
    try {
      await api.privacySettings({ [kind]: value })
      setNotice(kind === 'aiProcessing'
        ? value ? 'AI processing enabled — analysis can start when you open the copilot.' : 'AI processing disabled — no new conversation content goes to the provider.'
        : value ? 'Media analysis enabled.' : 'Media analysis disabled — media is never sent to the AI provider now.')
      window.setTimeout(() => setNotice(null), 4000)
    } catch { /* surfaced by parent toast */ }
    setBusy(false)
  }

  async function doDelete(scope: 'conversation' | 'ai' | 'media' | 'all', chatId?: string) {
    setBusy(true)
    try {
      await api.deleteData(scope, chatId)
      if (scope === 'conversation' && chatId) {
        setConversationList((cur) => cur.filter((c) => c.id !== chatId))
        setNotice('Connected conversation removed.')
      }
      window.setTimeout(() => setNotice(null), 4000)
      setConfirm(null)
    } catch { /* ignore */ }
    setBusy(false)
  }

  async function doDisconnect(mode: 'only' | 'all') {
    setBusy(true)
    try {
      await api.disconnect(mode === 'all')
      setDisconnectMode(null)
      onClose()
    } catch { /* ignore */ }
    setBusy(false)
  }

  const aiOn = privacy.aiProcessing
  const mediaOn = privacy.mediaAnalysis

  return (
    <Modal wide title={<span><Icon name="shield" size={17} /> Privacy Center</span>} onClose={onClose}>
      {notice && <div className="banner ok">{notice}</div>}
      {sse && <div className="banner warn">{sse}</div>}

      <div className="privacy-grid">
        {/* WhatsApp connection */}
        <section className="privacy-card">
          <h4><Icon name="whatsapp" size={16} /> WhatsApp Connection</h4>
          <p>Only your explicitly linked device connection is used. Everything is session-memory only — nothing is written to disk.</p>
          <button className="btn ghost sm" disabled={busy} onClick={() => setDisconnectMode('only')}>
            Disconnect WhatsApp…
          </button>
        </section>

        {/* AI processing */}
        <section className="privacy-card">
          <h4><Icon name="spark" size={16} /> AI Processing</h4>
          <p>
            Selected conversation content may be processed by the configured AI provider to generate insights and reply suggestions.
            It is <strong>off by default</strong> and only runs when you ask for an analysis.
          </p>
          <ToggleRow
            label="AI analysis"
            hint="Stops all new conversation content being sent to the AI provider."
            on={aiOn}
            disabled={busy}
            onChange={(v) => void setSetting('aiProcessing', v)}
          />
          <ToggleRow
            label="Allow media analysis"
            hint="When off, images and videos are never referenced or described by the AI."
            on={mediaOn}
            disabled={busy}
            onChange={(v) => void setSetting('mediaAnalysis', v)}
          />
          {mediaOn && (
            <p className="tiny-note">Even with media analysis on, SOULSYNC never uploads your private media — the AI only sees that media was sent, so it cannot describe private images it has not seen.</p>
          )}
          <p className="tiny-note">Automatic sending: always off. SOULSYNC never sends a message without your explicit Approve &amp; Send.</p>
        </section>

        {/* Connected conversations */}
        <section className="privacy-card">
          <h4><Icon name="lock" size={16} /> Connected Conversations</h4>
          <p>Only conversations you explicitly connected are synchronized. Remove one any time — it stops syncing instantly.</p>
          <ul className="pconv-list">
            {conversationList.length === 0 ? <li className="muted">No conversations connected.</li> : conversationList.map((c) => (
              <li key={c.id}>
                <span className="pconv-name">{c.name}</span>
                <button className="btn ghost sm danger" disabled={busy} onClick={() => setConfirm({ scope: 'conversation' })} data-chat={c.id}>
                  <Icon name="trash" size={13} /> Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Consent record */}
        <section className="privacy-card">
          <h4><Icon name="shield" size={16} /> Consent record</h4>
          <p>Your explicit privacy decisions, recorded at the time you made them:</p>
          <ul className="consent-record">
            {consents.length === 0 ? <li>No consent events yet.</li> : consents.slice(-6).reverse().map((c, i) => (
              <li key={`${c.type}-${c.ts}-${i}`}>
                <strong>{c.type}</strong>
                <span>{c.action} · {formatAgo(c.ts)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {confirm && (
        <Modal
          title={confirm.scope === 'conversation' ? 'Remove this conversation?' : 'Delete data?'}
          onClose={() => setConfirm(null)}
          footer={
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn danger" onClick={() => void doDelete(confirm.scope)}>{confirm.scope === 'conversation' ? 'Remove' : 'Delete'}</button>
            </div>
          }
        >
          <p>
            {confirm.scope === 'conversation'
              ? 'This stops synchronization for the selected conversation and deletes its synced messages from this session immediately.'
              : 'This deletes the selected data from this session immediately. It cannot be undone.'}
          </p>
        </Modal>
      )}

      {disconnectMode && (
        <Modal
          title="Disconnect WhatsApp?"
          onClose={() => setDisconnectMode(null)}
          footer={
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDisconnectMode(null)}>Cancel</button>
              <button className="btn ghost" disabled={busy} onClick={() => void doDisconnect('only')}>Disconnect Only</button>
              <button className="btn danger" disabled={busy} onClick={() => void doDisconnect('all')}>Disconnect &amp; Delete Imported Data</button>
            </div>
          }
        >
          <p><strong>This will stop SOULSYNC from synchronizing this connection.</strong></p>
          <p><strong>Disconnect Only</strong> keeps the imported conversations in this session’s memory.<br />
             <strong>Disconnect &amp; Delete Imported Data</strong> also removes every connected conversation, message and media from memory right away.</p>
        </Modal>
      )}
    </Modal>
  )
}

function ToggleRow({ label, hint, on, onChange, disabled }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label className="toggle-row">
      <span className="toggle-text">
        <strong>{label}</strong>
        <span>{hint}</span>
      </span>
      <span className={`switch ${on ? 'on' : ''}`}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        <i />
      </span>
    </label>
  )
}
