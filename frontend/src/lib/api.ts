export interface CrewSession {
  key: string
  kind: string
  channel: string
  displayName?: string
  label?: string
  updatedAt: number
  sessionId: string
  model?: string
  contextTokens?: number
  totalTokens?: number
  systemSent?: boolean
  abortedLastRun?: boolean
  lastChannel?: string
  transcriptPath?: string
  deliveryContext?: {
    channel?: string
    to?: string
    accountId?: string
  }
  messages?: SessionMessage[]
}

export interface SessionMessage {
  role: string
  content: SessionContentBlock[]
  api?: string
  provider?: string
  model?: string
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      total: number
    }
  }
  stopReason?: string
  timestamp?: number
}

export interface SessionContentBlock {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  arguments?: Record<string, unknown>
  toolCallId?: string
  toolName?: string
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}

export interface SessionsResponse {
  sessions: CrewSession[]
}

export interface SessionHistoryResponse {
  messages: SessionMessage[]
}

// Backwards compatibility aliases
export type MinionSession = CrewSession
export type MinionMessage = SessionMessage
export type MinionContentBlock = SessionContentBlock

export const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json()
}

export const api = {
  getSessions: (activeMinutes?: number) =>
    fetchJSON<SessionsResponse>(`/sessions${activeMinutes ? `?active_minutes=${activeMinutes}` : ''}`),

  getSessionHistory: (sessionKey: string, limit: number = 50) =>
    fetchJSON<SessionHistoryResponse>(`/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),

  // Backwards compatibility aliases
  getMinions: (activeMinutes?: number) =>
    fetchJSON<SessionsResponse>(`/sessions${activeMinutes ? `?active_minutes=${activeMinutes}` : ''}`),

  getMinionHistory: (sessionKey: string, limit: number = 50) =>
    fetchJSON<SessionHistoryResponse>(`/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),
}

// Session Display Names API
export interface SessionDisplayNameResponse {
  session_key: string
  display_name: string | null
  updated_at?: number
}

export const sessionDisplayNameApi = {
  get: (sessionKey: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/session-display-names/${encodeURIComponent(sessionKey)}`),
  
  set: (sessionKey: string, displayName: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/session-display-names/${encodeURIComponent(sessionKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName })
    }),
  
  delete: (sessionKey: string) =>
    fetchJSON<{ success: boolean; deleted: string }>(`/session-display-names/${encodeURIComponent(sessionKey)}`, {
      method: 'DELETE'
    }),
}
