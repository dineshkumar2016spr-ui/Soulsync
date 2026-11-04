// SOULSYNC AI panel: start-chat flow → relationship context → consent → analysis → approval-before-send
import { useState } from 'react'
import { REPLY_STYLES, RELATIONSHIP_OPTIONS, type Analysis, type AiProvider, type Chat, type ReplyStyle } from '../lib/types'
import { EmptyState, ErrorState, Icon, LoadingState } from './ui'

type Phase = 'idle' | 'consent' | 'relationship' | 'analyzing' | 'ready' | 'error' | 'empty'

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

export function CopilotPanel({
  chat, analysis, analyzedCount, provider, aiEnabled, onSetAiEnabled, mediaAnalysis, onSetMediaAnalysis,
  relationship, onSetRelationship, onAnalyze, onSendSuggested, busy,
}: {
  chat: Chat | null
  analysis: Analysis | null
  analyzedCount: number
  provider: AiProvider
  aiEnabled: boolean
  onSetAiEnabled: (v: boolean) => Promise<void>
  mediaAnalysis: boolean
  onSetMediaAnalysis: (v: boolean) => Promise<void>
  relationship: string | null
  onSetRelationship: (rel: string) => Promise<void>
  onAnalyze: (style: ReplyStyle) => Promise<{ analysis: Analysis; count: number } | { error: string } | { empty: string } | null>
  onSendSuggested: (text: string) => Promise<boolean>
  busy: boolean
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  async function runAnalysis(style: ReplyStyle) {
    if (!chat) return
    setAnalyzing(true)
    setPhase('analyzing')
    const result = await onAnalyze(style)
    setAnalyzing(false)
    if (result && 'error' in result) {
      setError(result.error)
      setPhase('error')
      return
    }
    if (result && 'empty' in result) {
      // No messages yet — nothing to analyze, show the honest empty state
      setPhase('empty')
      return
    }
    setPhase('ready')
  }

  /* -------- flow steps -------- */
  function startChat() {
    setPhase(aiEnabled ? (relationship ? 'analyzing' : 'relationship') : 'consent')
    if (aiEnabled && relationship) void runAnalysis('Natural')
  }

  async function allowAi(withMedia: boolean) {
    await onSetAiEnabled(true)
    if (withMedia && !mediaAnalysis) await onSetMediaAnalysis(true)
    setPhase(relationship ? 'analyzing' : 'relationship')
    if (relationship) void runAnalysis('Natural')
  }

  async function pickRelationship(rel: string) {
    await onSetRelationship(rel)
    void runAnalysis('Natural')
  }

  return (
    <aside className="panel-right">
      <header className="copilot-head">
        <div className="copilot-orb" aria-hidden="true"><Icon name="spark" size={18} /></div>
        <div>
          <strong>SOULSYNC AI</strong>
          <span className="copilot-tag">Your private relationship copilot.</span>
        </div>
        {provider && <span className="provider-chip">{PROVIDER_LABEL[provider]}</span>}
      </header>
      <CopilotBody
        chat={chat}
        analysis={analysis}
        analyzedCount={analyzedCount}
        phase={phase}
        setPhase={setPhase}
        error={error}
        analyzing={analyzing}
        provider={provider}
        relationship={relationship}
        busy={busy}
        startChat={startChat}
        allowAi={allowAi}
        pickRelationship={pickRelationship}
        runAnalysis={runAnalysis}
        onSendSuggested={onSendSuggested}
      />
    </aside>
  )
}

function CopilotBody({
  chat, analysis, analyzedCount, phase, setPhase, error, analyzing, provider,
  relationship, busy, startChat, allowAi, pickRelationship, runAnalysis, onSendSuggested,
}: {
  chat: Chat | null
  analysis: Analysis | null
  analyzedCount: number
  phase: Phase
  setPhase: (p: Phase) => void
  error: string | null
  analyzing: boolean
  provider: AiProvider
  relationship: string | null
  busy: boolean
  startChat: () => void
  allowAi: (media: boolean) => Promise<void>
  pickRelationship: (rel: string) => Promise<void>
  runAnalysis: (s: ReplyStyle) => Promise<void>
  onSendSuggested: (t: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState('')
  const [edited, setEdited] = useState(false)
  const [style, setStyle] = useState<ReplyStyle>('Natural')
  const [approved, setApproved] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function approveAndSend() {
    if (!chat || !draft.trim() || approved) return
    setSending(true)
    setSendError(null)
    const ok = await onSendSuggested(draft.trim())
    setSending(false)
    if (ok) {
      setApproved(true)
      setSent(true)
    } else {
      setSendError('⚠ Message not sent — Retry once WhatsApp is connected again.')
    }
  }

  function useAlternative(alt: string) {
    setDraft(alt)
    setEdited(true)
    setSent(false)
  }

  const contextRow = (
    <section className="ai-section">
      <h4>Conversation Context</h4>
      <div className="kv"><span>Relationship</span><strong>{relationship ?? 'Not set'}</strong></div>
      <div className="kv"><span>Status</span><strong>{phase === 'ready' ? 'Analysis complete' : analyzing ? 'Analyzing' : 'Awaiting analysis'}</strong></div>
      {analyzedCount > 0 && <div className="kv"><span>Read from</span><strong>{analyzedCount} recent messages</strong></div>}
    </section>
  )

  if (phase === 'consent') {
    return (
      <div className="copilot-body">
        <div className="consent-card">
          <h3><Icon name="shield" size={17} /> Let SOULSYNC analyze this conversation?</h3>
          <p>SOULSYNC will process the selected conversation to help identify communication patterns and generate reply suggestions.</p>
          <ul>
            <li>The text of this conversation is sent to the active AI provider ({provider ? PROVIDER_LABEL[provider] : 'configured provider'}).</li>
            <li>Media (photos/videos) is <strong>not</strong> included unless you separately allow media analysis.</li>
            <li>AI processing is off right now for <strong>{chat?.name}</strong>. You can change it at any time in the Privacy Center.</li>
          </ul>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setPhase('idle')}>Not Now</button>
            <button className="btn primary" onClick={() => void allowAi(false)}>Allow AI Analysis</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'relationship') {
    return (
      <div className="copilot-body">
        <div className="rel-select">
          <h3>What is this relationship?</h3>
          <p className="muted-line">This helps the copilot read context — without assuming anything.</p>
          <div className="rel-grid">
            {RELATIONSHIP_OPTIONS.map((o) => (
              <button key={o.label} className="rel-chip" onClick={() => void pickRelationship(o.label)}>
                <span aria-hidden="true">{o.icon}</span> {o.label}
              </button>
            ))}
          </div>
          <button className="btn subtle" onClick={() => void pickRelationship("I'm not sure yet")}>I'm not sure yet</button>
        </div>
      </div>
    )
  }

  if (phase === 'analyzing') {
    return (
      <div className="copilot-body">
        <div className="ai-analyzing">
          <span className="analyze-pulse" aria-hidden="true"><Icon name="spark" size={16} /></span>
          <p><Icon name="eye" size={13} /> AI analyzing selected conversation…</p>
          <LoadingState label={`Reading ${chat?.name ?? ''} — tone, patterns, momentum.`} />
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="copilot-body">
        {contextRow}
        <ErrorState
          title="AI is unavailable"
          body={error ?? 'The provider could not process this request.'}
          action={
            <div className="state-actions">
              <button className="btn primary sm" onClick={() => void runAnalysis(style)}>Try again</button>
              <button className="btn ghost sm" onClick={() => setPhase('idle')}>Back</button>
            </div>
          }
        />
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="copilot-body">
        <EmptyState
          icon="spark"
          title="Nothing to analyze yet."
          body="There are no messages in this conversation yet. Once messages are synced, start a chat with SOULSYNC AI when you're ready."
          action={<button className="btn ghost sm" onClick={() => setPhase('idle')}>Back</button>}
        />
      </div>
    )
  }

  if (phase === 'idle') {
    return (
      <div className="copilot-body">
        <div className="copilot-hero">
          <h3>Ready when you are.</h3>
          <p>“I’ll help you understand this conversation and choose your next words.” You stay in control — I never send anything without your explicit approval.</p>
          {provider === null && (
            <div className="ai-unavailable-note">
              <Icon name="alert" size={14} />
              No AI provider is configured on this server yet. Add <code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code> to enable the copilot.
            </div>
          )}
          <button className="btn primary" onClick={startChat} disabled={provider === null}>
            <Icon name="spark" size={15} /> Start Chat
          </button>
        </div>
      </div>
    )
  }

  // phase === 'ready'
  const a = analysis
  const snap = a?.snapshot
  const sms = a?.alternatives ?? []

  return (
    <div className="copilot-body">
      {analyzing && (
        <div className="ai-analyzing slim">
          <span className="analyze-pulse small" aria-hidden="true"><Icon name="spark" size={14} /></span>
          <p><Icon name="eye" size={13} /> AI analyzing selected conversation…</p>
        </div>
      )}

      {contextRow}

      <section className="ai-section">
        <h4>Current Read</h4>
        <p className="ai-text">{a?.currentRead || 'No read available yet — press "Start New Analysis" below.'}</p>
      </section>

      <section className="ai-section">
        <h4>Suggested Reply {edited && <em className="edited-tag">edited by you</em>}</h4>
        <div className="ai-suggestion" data-approved={String(approved)}>
          <span className="suggestion-label">AI Suggested Reply{edited && !approved ? ' (edited)' : ''}</span>
          {sent && approved ? (
            <p className="suggestion-text sent">{draft}</p>
          ) : (
            <textarea
              className="suggestion-text editable"
              value={draft}
              rows={4}
              onChange={(e) => {
                setDraft(e.target.value)
                setEdited(true)
                setApproved(false)
                setSent(false)
              }}
            />
          )}
          <div className="suggestion-actions">
            <button
              className="btn ghost sm"
              onClick={() => void navigator.clipboard.writeText(draft)}
            ><Icon name="copy" size={14} /> Copy</button>
            <button
              className="btn ghost sm"
              disabled={!edited}
              onClick={() => { if (a) { setDraft(a.suggestedReply); setEdited(false); setApproved(false); setSent(false) } }}
            ><Icon name="refresh" size={14} /> Reset</button>
            {sent && approved
              ? <span className="sent-note"><Icon name="check" size={14} /> Sent</span>
              : (
                <button
                  className="btn primary sm"
                  disabled={sending || !draft.trim() || busy}
                  onClick={() => void approveAndSend()}
                >{sending ? 'Sending…' : <><Icon name="send" size={14} /> Approve &amp; Send</>}</button>
              )}
          </div>
          {sendError && (
            <div className="send-error">
              <p className="inline-error"><Icon name="alert" size={13} /> {sendError}</p>
              <button className="btn ghost sm" onClick={() => { setSendError(null); void approveAndSend() }}>Retry</button>
            </div>
          )}
        </div>

        {a?.whyThisWorks && (
          <div className="why-it-works">
            <span>Why this works</span>
            <p>{a.whyThisWorks}</p>
          </div>
        )}
      </section>

      {sms.length > 0 && (
        <section className="ai-section">
          <h4>Alternative Replies</h4>
          <ul className="alternatives">
            {sms.map((alt, i) => (
              <li key={i}>
                <p>{alt}</p>
                <button className="btn ghost sm" onClick={() => useAlternative(alt)}>Use</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ai-section">
        <h4>Relationship Insight</h4>
        <p className="ai-text">
          {a?.insight || 'There isn’t enough signal in this conversation yet to say anything meaningful — the more it unfolds, the sharper the read.'}
        </p>
      </section>

      {snap && (snap.overall || snap.energy || snap.reciprocity) && (
        <section className="ai-section snapshot">
          <h4>Relationship Snapshot</h4>
          <dl className="snap-grid">
            {snap.overall && <div><dt>Overall dynamic</dt><dd>{snap.overall}</dd></div>}
            {snap.energy && <div><dt>Communication energy</dt><dd>{snap.energy}</dd></div>}
            {snap.reciprocity && <div><dt>Reciprocity</dt><dd>{snap.reciprocity}</dd></div>}
            {snap.positive && <div><dt>Positive signals</dt><dd>{snap.positive}</dd></div>}
            {snap.friction && <div><dt>Potential friction</dt><dd>{snap.friction}</dd></div>}
            {snap.watch && <div><dt>What to watch</dt><dd>{snap.watch}</dd></div>}
          </dl>
        </section>
      )}

      <section className="ai-section">
        <h4>Tone for the next draft</h4>
        <div className="style-row">
          {REPLY_STYLES.map((s) => (
            <button
              key={s}
              className={`style-chip ${style === s ? 'active' : ''}`}
              onClick={() => {
                setStyle(s)
                void runAnalysis(s)
              }}
              disabled={analyzing}
            >{s}</button>
          ))}
        </div>
        <button className="btn ghost full" onClick={() => void runAnalysis(style)} disabled={analyzing}>
          <Icon name="refresh" size={15} /> Start New Analysis
        </button>
      </section>
    </div>
  )
}
