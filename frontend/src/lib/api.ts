export interface MinionSession {
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
  messages?: MinionMessage[]
}

export interface MinionMessage {
  role: string
  content: MinionContentBlock[]
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

export interface MinionContentBlock {
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

export interface MinionsResponse {
  sessions: MinionSession[]
}

export interface MinionHistoryResponse {
  messages: MinionMessage[]
}

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
  getMinions: (activeMinutes?: number) =>
    fetchJSON<MinionsResponse>(`/minions${activeMinutes ? `?active_minutes=${activeMinutes}` : ''}`),

  getMinionHistory: (sessionKey: string, limit: number = 50) =>
    fetchJSON<MinionHistoryResponse>(`/minions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`),
}

// Session Display Names API
export interface SessionDisplayNameResponse {
  session_key: string
  display_name: string | null
  updated_at?: number
}

export const sessionDisplayNameApi = {
  get: (sessionKey: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/sessions/${encodeURIComponent(sessionKey)}/display-name`),
  
  set: (sessionKey: string, displayName: string) =>
    fetchJSON<SessionDisplayNameResponse>(`/sessions/${encodeURIComponent(sessionKey)}/display-name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName })
    }),
  
  delete: (sessionKey: string) =>
    fetchJSON<{ session_key: string; deleted: boolean }>(`/sessions/${encodeURIComponent(sessionKey)}/display-name`, {
      method: 'DELETE'
    }),
}
