// SOULSYNC API client — all calls are same-origin, cookie-based sessions
import type {
  AnalyzeResponse, AiStatus, AvailableChat, Chat, ConsentRecord, Message, PrivacySettings, RelationshipType, ReplyStyle, WhatsAppStatus,
} from './types'

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof (data as { error?: string }).error === 'string' ? (data as { error: string }).error : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return data as T
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function get<T>(url: string): Promise<T> {
  return fetch(url, { credentials: 'same-origin' }).then((r) => json<T>(r))
}
function post<T>(url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((r) => json<T>(r))
}

export const api = {
  whatsappStatus: () => get<WhatsAppStatus>('/api/whatsapp/status'),
  connectWhatsApp: (consent: boolean) => post<{ status: string; error: string | null }>('/api/whatsapp/connect', { consent }),
  qr: async (): Promise<string> => {
    const d = await get<{ dataUrl: string }>('/api/whatsapp/qr.svg')
    return d.dataUrl
  },
  pairCode: async (phone: string): Promise<{ code: string; phone: string }> => {
    return post('/api/whatsapp/pair-code', { phone })
  },
  availableChats: () => get<{ chats: AvailableChat[] }>('/api/whatsapp/chats/available'),
  importChats: (chatIds: string[], consent: boolean) => post<{ success: boolean; count: number }>('/api/whatsapp/import', { chatIds, consent }),
  removeChat: (chatId: string) => post<{ success: boolean }>('/api/whatsapp/remove', { chatId }),
  chats: () => get<{ chats: Chat[] }>('/api/whatsapp/chats'),
  markRead: (chatId: string) => post<{ success: boolean }>('/api/whatsapp/chats/read', { chatId }),
  disconnect: (deleteData: boolean) => post<{ success: boolean }>('/api/whatsapp/disconnect', { deleteData }),

  messages: async (chatId: string, before?: number, limit = 60): Promise<{ messages: Message[]; hasOlder: boolean }> => {
    const params = new URLSearchParams({ chatId, limit: String(limit) })
    if (before) params.set('before', String(before))
    return get(`/api/whatsapp/messages?${params}`)
  },
  requestHistory: (chatId: string) => post<{ success: boolean; note?: string }>('/api/whatsapp/chats/history', { chatId }),
  sendText: (chatId: string, text: string) => post<{ success: boolean; message: Message }>('/api/whatsapp/send', { chatId, text }),
  sendMedia: (chatId: string, kind: 'image' | 'video', data: string, mime: string, caption?: string) =>
    post<{ success: boolean; message: Message }>('/api/whatsapp/send-media', { chatId, kind, data, mime, caption }),

  mediaUrl: (chatId: string, msgId: string) => `/api/whatsapp/media/${encodeURIComponent(chatId)}/${encodeURIComponent(msgId)}`,

  relationship: (chatId: string, relationship: RelationshipType | string) => fetch('/api/relationship', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, relationship }),
  }).then((r) => json<{ success: boolean }>(r)),

  aiStatus: () => get<AiStatus>('/api/ai/status'),
  analyze: (opts: { chatId: string; relationship?: string; kind: 'analysis' | 'reply'; style?: ReplyStyle }) =>
    post<AnalyzeResponse>('/api/ai/analyze', opts),

  privacy: () => get<{ privacy: PrivacySettings; consents: ConsentRecord[]; conversations: { id: string; name: string }[]; mediaCacheBytes: number; me: unknown }>('/api/privacy'),
  privacySettings: (patch: { aiProcessing?: boolean; mediaAnalysis?: boolean }) => post<{ privacy: PrivacySettings }>('/api/privacy/settings', patch),
  deleteData: (scope: 'ai' | 'media' | 'conversation' | 'all', chatId?: string) => post<{ success: boolean }>('/api/privacy/delete', { scope, chatId }),
}

/** Upload progress via XHR so the UI can show real percent progress */
export function uploadWithProgress(
  url: string,
  body: Record<string, unknown>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ApiError(xhr.responseText || 'Upload failed', xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Network error while uploading', 0))
    xhr.send(JSON.stringify(body))
  })
}

export function timeShort(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date(); const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function initials(name: string): string {
  const clean = name.replace(/^\+/, '').split(/[\s._-]+/).filter(Boolean)
  const chars = clean.map((p) => p[0]).join('')
  return (chars.length > 0 ? chars.slice(0, 2) : name.slice(0, 2) || 'SO').toUpperCase()
}
