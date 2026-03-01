/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/cognitive-complexity */
/**
 * Centralized Activity Service
 *
 * Single source of truth for all activity/event data in CrewHub.
 * Used by:
 * - Desktop: ZenActivityPanel, ActivityLogStream
 * - Mobile: Activity Panel, ActiveTasksOverlay
 * - 3D World: ActivityLogStream
 *
 * This service ensures no duplicate fetches and consistent data across the app.
 */

import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

// ── Types ─────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string
  type:
    | 'created'
    | 'updated'
    | 'removed'
    | 'status'
    | 'message'
    | 'tool_call'
    | 'tool_result'
    | 'thinking'
  timestamp: number
  sessionKey: string
  sessionName?: string
  description: string
  icon: string
  color?: string
  details?: string
}

export interface LogEntry {
  role: string
  content: string
  timestamp?: number
  tools?: { name: string; status?: string }[]
}

export interface SessionHistory {
  sessionKey: string
  messages: LogEntry[]
  lastFetch: number
}

// ── Cache ─────────────────────────────────────────────────────

const historyCache = new Map<string, SessionHistory>()
const CACHE_TTL = 5000 // 5 seconds

// ── Tool humanization lookup ──────────────────────────────────

type ToolHint = { icon: string; color: string; label?: string }

const TOOL_HINTS: Record<string, ToolHint> = {
  process: { icon: '⚙️', color: '#6b7280', label: 'Managing process' },
}

function getFileLabel(
  action: string,
  icon: string,
  color: string,
  args?: Record<string, unknown>
): { text: string; icon: string; color: string } {
  const path = (args?.path ?? args?.file_path) as string | undefined
  const file = path ? path.split('/').pop() : ''
  return { text: file ? `${action} ${file}` : `${action} file`, icon, color }
}

function getQueryLabel(
  action: string,
  icon: string,
  color: string,
  key: string,
  fallback: string,
  args?: Record<string, unknown>
): { text: string; icon: string; color: string } {
  const val = args?.[key] as string | undefined
  return { text: val ? `${action}: ${val.slice(0, 60)}` : fallback, icon, color }
}

// ── Helper: Humanize Tool Calls ───────────────────────────────

function humanizeToolCall(
  name: string,
  args?: Record<string, unknown>
): { text: string; icon: string; color: string } {
  switch (name) {
    case 'exec': {
      const cmd = args?.command as string | undefined
      if (cmd)
        return {
          text: `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? '…' : ''}`,
          icon: '🔧',
          color: '#6b7280',
        }
      return { text: 'Executing command', icon: '🔧', color: '#6b7280' }
    }
    case 'Read':
    case 'read':
      return getFileLabel('Reading', '📖', '#3b82f6', args)
    case 'Write':
    case 'write':
      return getFileLabel('Writing', '✍️', '#22c55e', args)
    case 'Edit':
    case 'edit':
      return getFileLabel('Editing', '✏️', '#22c55e', args)
    case 'sessions_spawn': {
      const task = (args?.task ?? args?.label ?? 'sub-task') as string
      return { text: `Spawning sub-agent: ${task.slice(0, 60)}`, icon: '🤖', color: '#a855f7' }
    }
    case 'web_search':
      return getQueryLabel('Searching', '🔍', '#f59e0b', 'query', 'Searching the web', args)
    case 'web_fetch':
      return getQueryLabel('Fetching', '🌐', '#f59e0b', 'url', 'Fetching webpage', args)
    case 'message': {
      const action = args?.action as string | undefined
      return {
        text: action ? `Message: ${action}` : 'Sending message',
        icon: '💬',
        color: '#06b6d4',
      }
    }
    case 'browser': {
      const action = args?.action as string | undefined
      return { text: action ? `Browser: ${action}` : 'Using browser', icon: '🌐', color: '#8b5cf6' }
    }
    default: {
      const hint = TOOL_HINTS[name]
      if (hint) return { text: hint.label ?? `Using ${name}`, icon: hint.icon, color: hint.color }
      return { text: `Using ${name}`, icon: '🔧', color: '#6b7280' }
    }
  }
}

// ── Parse Messages to Log Entries ─────────────────────────────

function extractContentAndTools(msg: any): {
  content: string
  tools: { name: string; status?: string }[]
} {
  let content = ''
  const tools: { name: string; status?: string }[] = []

  if (typeof msg.content === 'string') {
    content = msg.content
  } else if (Array.isArray(msg.content)) {
    content = msg.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('\n')
    for (const c of msg.content) {
      if (c.type === 'toolCall' || c.type === 'tool_use') {
        tools.push({ name: c.name || c.toolName || 'tool' })
      }
    }
  }

  return { content, tools }
}

function parseMessagesToLogEntries(messages: any[]): LogEntry[] {
  const entries: LogEntry[] = []

  for (const m of messages) {
    // Standardized format from Claude Code: {role, content: string, metadata}
    if (m.role && typeof m.content === 'string' && !m.message) {
      const metadata = m.metadata
      const tools: { name: string; status?: string }[] = []
      if (metadata?.type === 'tool_use' && metadata.tool_name) {
        tools.push({ name: metadata.tool_name })
      }
      if (metadata?.type === 'tool_result') {
        tools.push({ name: metadata.tool_name || 'tool', status: metadata.is_error ? 'error' : 'done' })
      }
      const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : 'system'
      const content = m.content || (tools.length > 0 ? '' : '[no content]')
      if (content || tools.length > 0) {
        entries.push({
          role,
          content,
          timestamp: m.timestamp ? (typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime()) : undefined,
          tools,
        })
      }
      continue
    }

    // OpenClaw format: {message: {role, content}, timestamp}
    if (!m?.message?.role || m.message.role === 'thinking') continue

    const msg = m.message
    const { content, tools } = extractContentAndTools(msg)

    if (msg.role === 'toolResult' && msg.toolName) {
      const entry: LogEntry = {
        role: 'tool',
        content: content || `[${msg.toolName} result]`,
        timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined,
        tools: [],
      }
      if (entry.content || (entry.tools && entry.tools.length > 0)) entries.push(entry)
      continue
    }

    let role: string
    if (msg.role === 'assistant') {
      role = 'assistant'
    } else if (msg.role === 'user') {
      role = 'user'
    } else {
      role = 'system'
    }
    const entry: LogEntry = {
      role,
      content: content || (tools.length > 0 ? '' : '[no content]'),
      timestamp: m.timestamp ? new Date(m.timestamp).getTime() : undefined,
      tools,
    }
    if (entry.content || (entry.tools && entry.tools.length > 0)) entries.push(entry)
  }

  return entries
}
// NOSONAR
// ── Parse Messages to Activity Entries ────────────────────────

function makeId(prefix: string, ts: number): string {
  return `${prefix}-${ts}-${Math.random().toString(36).slice(2, 6)}`
}

function processAssistantBlock(block: any, ts: number, entries: ActivityEvent[]): void {
  // NOSONAR
  if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name) {
    const args = block.arguments || block.input
    const { text, icon, color } = humanizeToolCall(block.name, args)
    entries.push({
      id: block.id || makeId('tool', ts),
      timestamp: ts,
      sessionKey: '',
      description: text,
      type: 'tool_call',
      icon,
      color,
    })
  } else if (block.type === 'text' && block.text) {
    const preview = block.text.slice(0, 150).replaceAll('\n', ' ')
    if (preview.trim()) {
      entries.push({
        id: makeId('msg', ts),
        timestamp: ts,
        sessionKey: '',
        description: preview + (block.text.length > 150 ? '…' : ''),
        type: 'message',
        icon: '💭',
        color: '#374151',
      })
    }
  } else if (block.type === 'thinking' && block.thinking) {
    const preview = block.thinking.slice(0, 100).replaceAll('\n', ' ')
    if (preview.trim()) {
      entries.push({
        id: makeId('think', ts),
        timestamp: ts,
        sessionKey: '',
        description: preview + (block.thinking.length > 100 ? '…' : ''),
        type: 'thinking',
        icon: '🧠',
        color: '#9ca3af',
      })
    }
  }
}

function processToolResultEntry(inner: any, ts: number, entries: ActivityEvent[]): void {
  const toolName = inner.toolName || ''
  const isError = inner.isError
  if (!toolName) return
  entries.push({
    id: makeId('result', ts),
    timestamp: ts,
    sessionKey: '',
    description: isError ? `❌ ${toolName} failed` : `✓ ${toolName} done`,
    type: 'tool_result',
    icon: isError ? '❌' : '✅',
    color: isError ? '#ef4444' : '#6b7280',
  })
}

function parseMessagesToActivityEntries(messages: any[]): ActivityEvent[] {
  const entries: ActivityEvent[] = []

  for (const raw of messages) {
    const inner = raw.message || raw
    const role = inner.role || raw.role
    const content = inner.content || raw.content
    const ts = inner.timestamp || (raw.timestamp ? new Date(raw.timestamp).getTime() : 0)
    const metadata = raw.metadata || inner.metadata

    // Standardized format from Claude Code: {role, content: string, metadata}
    if (metadata) {
      if (metadata.type === 'tool_use' && metadata.tool_name) {
        const { text, icon, color } = humanizeToolCall(metadata.tool_name, metadata.input_data)
        entries.push({
          id: makeId('tool', ts),
          timestamp: ts,
          sessionKey: '',
          description: text,
          type: 'tool_call',
          icon,
          color,
        })
        continue
      }
      if (metadata.type === 'tool_result') {
        const toolName = metadata.tool_name || 'tool'
        const isError = metadata.is_error
        entries.push({
          id: makeId('result', ts),
          timestamp: ts,
          sessionKey: '',
          description: isError ? `❌ ${toolName} failed` : `✓ ${toolName} done`,
          type: 'tool_result',
          icon: isError ? '❌' : '✅',
          color: isError ? '#ef4444' : '#6b7280',
        })
        continue
      }
      if (role === 'assistant' && typeof content === 'string' && content.trim()) {
        const preview = content.slice(0, 150).replaceAll('\n', ' ')
        entries.push({
          id: makeId('msg', ts),
          timestamp: ts,
          sessionKey: '',
          description: preview + (content.length > 150 ? '…' : ''),
          type: 'message',
          icon: '💭',
          color: '#374151',
        })
        continue
      }
    }

    // Claude Code standardized format: content is a string, not array
    if (typeof content === 'string' && content.trim()) {
      const preview = content.slice(0, 150).replaceAll('\n', ' ')
      if (role === 'assistant') {
        entries.push({
          id: makeId('msg', ts),
          timestamp: ts,
          sessionKey: '',
          description: preview + (content.length > 150 ? '…' : ''),
          type: 'message',
          icon: '💭',
          color: '#374151',
        })
      } else if (role === 'user') {
        entries.push({
          id: makeId('msg', ts),
          timestamp: ts,
          sessionKey: '',
          description: preview + (content.length > 150 ? '…' : ''),
          type: 'message',
          icon: '👤',
          color: '#6b7280',
        })
      }
      continue
    }

    if (!content || !Array.isArray(content)) continue

    if (role === 'assistant') {
      for (const block of content) {
        processAssistantBlock(block, ts, entries)
      }
    } else if (role === 'toolResult') {
      processToolResultEntry(inner, ts, entries)
    }
  }

  return entries.slice(-20)
}

// ── API: Fetch Session History ───────────────────────────────

export async function fetchSessionHistory(
  sessionKey: string,
  options: { limit?: number; skipCache?: boolean } = {}
): Promise<SessionHistory> {
  const { limit = 100, skipCache = false } = options

  // Check cache first
  if (!skipCache) {
    const cached = historyCache.get(sessionKey)
    if (cached && Date.now() - cached.lastFetch < CACHE_TTL) {
      return cached
    }
  }

  try {
    const res = await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.status}`)
    }
    const data = await res.json()
    const messages = parseMessagesToLogEntries(data.messages || [])

    const result: SessionHistory = {
      sessionKey,
      messages,
      lastFetch: Date.now(),
    }

    historyCache.set(sessionKey, result)
    return result
  } catch (error) {
    console.error(`[activityService] Failed to fetch history for ${sessionKey}:`, error)
    throw error
  }
}

// ── API: Fetch Activity Entries ──────────────────────────────

export async function fetchActivityEntries(
  sessionKey: string,
  options: { limit?: number; skipCache?: boolean } = {}
): Promise<ActivityEvent[]> {
  const { limit = 50 } = options

  try {
    const res = await fetch(
      `${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch activity: ${res.status}`)
    }
    const data = await res.json()
    const entries = parseMessagesToActivityEntries(data.messages || [])

    // Set sessionKey for all entries
    entries.forEach((e) => {
      e.sessionKey = sessionKey
    })

    return entries
  } catch (error) {
    console.error(`[activityService] Failed to fetch activity for ${sessionKey}:`, error)
    return []
  }
}

// ── SSE: Subscribe to Activity Updates ───────────────────────

export function subscribeToActivityUpdates(sessionKey: string, callback: () => void): () => void {
  const handler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      const sessions = data.sessions || []
      const match = sessions.find((s: { key: string }) => s.key === sessionKey)
      if (match) {
        // Invalidate cache and notify
        historyCache.delete(sessionKey)
        callback()
      }
    } catch {
      // ignore parse errors
    }
  }

  return sseManager.subscribe('sessions-refresh', handler)
}

// ── Clear Cache ───────────────────────────────────────────────

export function clearActivityCache(sessionKey?: string) {
  if (sessionKey) {
    historyCache.delete(sessionKey)
  } else {
    historyCache.clear()
  }
}
