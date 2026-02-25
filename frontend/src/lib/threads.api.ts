/**
 * Thread (Group Chat) API client
 */
import { API_BASE } from './api'

// ── Types ──────────────────────────────────────────────────────

export interface ThreadParticipant {
  id: string
  thread_id: string
  agent_id: string
  agent_name: string
  agent_icon: string | null
  agent_color: string | null
  role: 'owner' | 'member'
  is_active: boolean
  joined_at: number
  left_at: number | null
}

export interface Thread {
  id: string
  kind: 'direct' | 'group'
  title: string | null
  title_auto: string | null
  created_by: string
  created_at: number
  updated_at: number
  archived_at: number | null
  last_message_at: number | null
  participant_count: number
  participants: ThreadParticipant[]
  settings: Record<string, unknown>
}

export interface ThreadMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent_id: string | null
  agent_name: string | null
  routing_mode: string | null
  target_agent_ids: string[] | null
  created_at: number
}

export interface ThreadsListResponse {
  threads: Thread[]
}

export interface ThreadMessagesResponse {
  messages: ThreadMessage[]
  hasMore: boolean
  oldestTimestamp: number | null
}

export interface SendMessageResponse {
  success: boolean
  user_message: ThreadMessage
  responses: ThreadMessage[]
  routed_to: string[]
}

// ── API Functions ──────────────────────────────────────────────

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }))
    throw new Error(err.detail || `HTTP ${resp.status}`)
  }
  return resp.json()
}

export const threadsApi = {
  list: (kind?: string, archived = false) =>
    fetchJSON<ThreadsListResponse>(`/threads?${kind ? `kind=${kind}&` : ''}archived=${archived}`),

  get: (threadId: string) => fetchJSON<Thread>(`/threads/${threadId}`),

  create: (data: { kind?: 'direct' | 'group'; title?: string; participant_agent_ids: string[] }) =>
    fetchJSON<Thread>('/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (threadId: string, data: { title?: string; archived?: boolean }) =>
    fetchJSON<Thread>(`/threads/${threadId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addParticipants: (threadId: string, agentIds: string[]) =>
    fetchJSON<Thread>(`/threads/${threadId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ agent_ids: agentIds }),
    }),

  removeParticipant: (threadId: string, agentId: string) =>
    fetchJSON<Thread>(`/threads/${threadId}/participants/${agentId}`, {
      method: 'DELETE',
    }),

  getMessages: (threadId: string, limit = 50, before?: number) =>
    fetchJSON<ThreadMessagesResponse>(
      `/threads/${threadId}/messages?limit=${limit}${before ? `&before=${before}` : ''}`
    ),

  sendMessage: (
    threadId: string,
    content: string,
    routingMode: 'broadcast' | 'targeted' = 'broadcast',
    targetAgentIds?: string[]
  ) =>
    fetchJSON<SendMessageResponse>(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        routing_mode: routingMode,
        target_agent_ids: targetAgentIds,
      }),
    }),
}
