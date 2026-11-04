// SOULSYNC shared types — mirror of the server's session-memory entities

export type SyncStatus = 'idle' | 'connecting' | 'qr' | 'open' | 'error'

export type Me = { id: string; name: string; number: string } | null

export type WhatsAppStatus = {
  status: SyncStatus
  qr: string | null
  me: Me
  error: string | null
  discovered: number
  importedCount: number
  lastSyncAt: string | null
}

export type AvailableChat = {
  id: string
  name: string
  lastMessage: string
  lastTs: number
}

export type Chat = {
  id: string
  name: string
  unread: number
  lastMessage: string
  lastTs: number
}

export type MessageKind = 'text' | 'image' | 'image_caption' | 'video' | 'video_caption' | 'audio' | 'sticker' | 'document' | 'system'

export type MessageStatus = 'sent' | 'received' | 'update'

export type Message = {
  id: string
  chatId: string
  fromMe: boolean
  senderJid?: string
  text: string
  kind: MessageKind
  caption?: string
  timestamp: number
  status: MessageStatus | number
  hasMedia?: boolean
}

export type PrivacySettings = {
  aiProcessing: boolean
  mediaAnalysis: boolean
  autoSend: false
}

export type ConsentRecord = {
  type: string
  action: 'granted' | 'revoked'
  ts: number
  version: string
}

export type AiProvider = 'openai' | 'gemini' | null

export type AiStatus = {
  provider: AiProvider
  aiEnabled: boolean
  mediaAnalysis: boolean
  autoSend: false
}

export type RelationshipSnapshot = {
  overall: string
  energy: string
  reciprocity: string
  positive: string
  friction: string
  watch: string
}

export type Analysis = {
  currentRead: string
  intimacySignal: string
  suggestedReply: string
  whyThisWorks: string
  alternatives: string[]
  insight: string
  snapshot: RelationshipSnapshot
}

export type AnalyzeResponse = {
  analysis: Analysis
  provider: AiProvider
  analyzedCount: number
}

export type RelationshipType =
  | 'Talking Stage'
  | 'Dating'
  | 'Casual Relationship'
  | 'Serious Relationship'
  | 'Exclusive Relationship'
  | 'Long-Distance'
  | 'Partner'
  | 'Spouse'
  | 'Open Relationship'
  | 'Reconnecting'
  | 'Mutual Interest'
  | 'Custom'
  | "I'm not sure yet"

export const RELATIONSHIP_OPTIONS: { label: RelationshipType; icon: string }[] = [
  { label: 'Talking Stage', icon: '🌱' },
  { label: 'Dating', icon: '💕' },
  { label: 'Casual Relationship', icon: '🌤' },
  { label: 'Serious Relationship', icon: '❤️' },
  { label: 'Exclusive Relationship', icon: '💍' },
  { label: 'Long-Distance', icon: '🌍' },
  { label: 'Partner', icon: '🤝' },
  { label: 'Spouse', icon: '⚭' },
  { label: 'Open Relationship', icon: '🔓' },
  { label: 'Reconnecting', icon: '🕰' },
  { label: 'Mutual Interest', icon: '✨' },
  { label: 'Custom', icon: '✎' },
]

export const REPLY_STYLES = ['Natural', 'Casual', 'Warm', 'Romantic', 'Playful', 'Confident', 'Apologetic', 'Direct', 'Short', 'Detailed'] as const
export type ReplyStyle = (typeof REPLY_STYLES)[number]

// Realtime event names (server → client over SSE)
export type SyncEvent =
  | 'SYNC_CONNECTED'
  | 'SYNC_DISCONNECTED'
  | 'SYNC_RECONNECTING'
  | 'SYNC_QR_AVAILABLE'
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_SENT'
  | 'MESSAGE_UPDATED'
  | 'MEDIA_RECEIVED'
  | 'HISTORY_SYNC'
  | 'CONVERSATIONS_CONNECTED'
  | 'CONVERSATION_REMOVED'
  | 'AUTH_EXPIRED'
  | 'PRIVACY_UPDATED'
  | 'DATA_DELETED'
