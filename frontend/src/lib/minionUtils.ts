import type { CrewSession, SessionContentBlock } from './api'

// Type aliases for backwards compatibility
type MinionSession = CrewSession
type MinionContentBlock = SessionContentBlock
import { getTaskEmoji, generateFriendlyName } from './friendlyNames'
import { SESSION_CONFIG } from './sessionConfig'

export type SessionStatus = 'active' | 'idle' | 'sleeping' | 'supervising'

export interface ActivityEvent {
  timestamp: number
  type: 'message' | 'tool_call' | 'thinking'
  icon: string
  text: string
  role?: 'user' | 'assistant' | 'system'
}

export function getSessionStatus(
  session: MinionSession,
  allSessions?: MinionSession[]
): SessionStatus {
  const timeSinceUpdate = Date.now() - session.updatedAt
  if (timeSinceUpdate < SESSION_CONFIG.statusActiveThresholdMs) return 'active'

  // Check if this session has active subagents (parent appears idle but subagent is working)
  if (allSessions && hasActiveSubagents(session, allSessions)) return 'supervising'

  if (timeSinceUpdate < SESSION_CONFIG.statusSleepingThresholdMs) return 'idle'
  return 'sleeping'
}

/**
 * Check if a session has active child/subagent sessions.
 * Detects parent-child relationships by:
 * 1. Session key prefix matching (e.g. agent:dev:main → agent:dev:subagent:*)
 * 2. Label containing parent session reference
 * 3. Cron sessions spawning subagents for the same agent
 */
export function hasActiveSubagents(session: MinionSession, allSessions: MinionSession[]): boolean {
  const key = session.key || ''
  const parts = key.split(':')

  // Only check for main sessions and cron sessions (they spawn subagents)
  if (parts.length < 3) return false
  const agentId = parts[1] // e.g. "dev", "main"
  const sessionType = parts[2] // e.g. "main", "cron"
  if (sessionType !== 'main' && sessionType !== 'cron') return false

  const now = Date.now()

  // Primary check: child session's updatedAt within threshold (original logic)
  const hasRecentChild = allSessions.some((s) => {
    if (s.key === key) return false // skip self
    const childParts = s.key.split(':')
    if (childParts.length < 3) return false
    // Must be same agent and a subagent/spawn type
    if (childParts[1] !== agentId) return false
    if (!childParts[2]?.includes('subagent') && !childParts[2]?.includes('spawn')) return false
    // Child must be recently active (within active threshold)
    const childAge = now - s.updatedAt
    return childAge < SESSION_CONFIG.statusActiveThresholdMs
  })

  if (hasRecentChild) return true

  // Secondary check (v2026.2.17 compensation):
  // Announce routing from sub-subagents bumps THIS session's updatedAt (not the child's).
  // If we recently received a bump AND we have any child sessions → still supervising.
  const SUPERVISING_GRACE_MS = 60_000 // 1 minute grace window
  const thisSessionAge = now - (session.updatedAt || 0)
  if (thisSessionAge < SUPERVISING_GRACE_MS) {
    const hasAnyChild = allSessions.some((s) => {
      if (s.key === key) return false
      const childParts = s.key.split(':')
      return (
        childParts.length >= 3 &&
        childParts[1] === agentId &&
        (childParts[2]?.includes('subagent') || childParts[2]?.includes('spawn'))
      )
    })
    if (hasAnyChild) {
      return true
    }
  }

  return false
}

export function getStatusIndicator(status: SessionStatus): {
  emoji: string
  color: string
  label: string
} {
  switch (status) {
    case 'active':
      return { emoji: '🟢', color: 'text-green-500', label: 'Active' }
    case 'idle':
      return { emoji: '🟡', color: 'text-yellow-500', label: 'Idle' }
    case 'supervising':
      return { emoji: '👁️', color: 'text-blue-500', label: 'Supervising' }
    case 'sleeping':
      return { emoji: '💤', color: 'text-gray-400', label: 'Sleeping' }
  }
}

/**
 * Heuristic to detect announce-routing messages injected into parent sessions.
 * OpenClaw v2026.2.17 routes sub-subagent result announces to the parent session
 * as user-role messages. We skip them to avoid showing sub-subagent results
 * as parent's own activity in BotActivityBubble.
 * Conservative patterns — refine after observing actual announce format.
 */
function _isLikelyAnnounceRouting(text: string): boolean {
  return (
    text.startsWith('[Subagent result]') ||
    text.startsWith('[Agent completed]') ||
    text.startsWith('[announce]') ||
    /^(Subagent|Sub-agent)\s+\S+\s+(completed|finished|done)/i.test(text)
  )
}

export function parseRecentActivities(session: MinionSession, limit = 5): ActivityEvent[] {
  if (!session.messages || session.messages.length === 0) return []
  const activities: ActivityEvent[] = []
  const recentMessages = session.messages.slice(-limit * 2).reverse()

  for (const msg of recentMessages) {
    if (activities.length >= limit) break
    const timestamp = msg.timestamp || session.updatedAt

    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (activities.length >= limit) break
        if (block.type === 'text' && block.text && block.text.trim()) {
          const text = block.text.trim()
          if (text === 'NO_REPLY' || text === 'HEARTBEAT_OK') continue
          // Issue 1 fix: skip routed announce messages from sub-subagents
          // These are injected into the parent session by OpenClaw's announce routing.
          if (msg.role === 'user' && _isLikelyAnnounceRouting(text)) continue
          activities.push({
            timestamp,
            type: 'message',
            icon: msg.role === 'user' ? '👤' : '🤖',
            text: text.length > 80 ? text.slice(0, 80) + '…' : text,
            role: msg.role as 'user' | 'assistant' | 'system',
          })
        }
        if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name) {
          const target = getToolTarget(block)
          activities.push({
            timestamp,
            type: 'tool_call',
            icon: '🔧',
            text: target ? `${block.name} → ${target}` : block.name,
            role: 'assistant',
          })
        }
        if (block.type === 'thinking' && block.thinking) {
          activities.push({
            timestamp,
            type: 'thinking',
            icon: '💭',
            text: block.thinking.length > 80 ? block.thinking.slice(0, 80) + '…' : block.thinking,
            role: 'assistant',
          })
        }
      }
    }
  }
  return activities
}

function getToolTarget(block: MinionContentBlock): string | null {
  if (!block.arguments) return null
  try {
    const args = block.arguments
    if (args.path && typeof args.path === 'string') return extractFilename(args.path)
    if (args.file_path && typeof args.file_path === 'string') return extractFilename(args.file_path)
    if (args.url && typeof args.url === 'string') return extractDomain(args.url)
    if (args.command && typeof args.command === 'string') return args.command.split(' ')[0]
    return null
  } catch {
    return null
  }
}

function extractFilename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function getCurrentActivity(session: MinionSession, allSessions?: MinionSession[]): string {
  const activities = parseRecentActivities(session, 1)
  if (activities.length === 0) {
    const status = getSessionStatus(session, allSessions)
    const timeSinceUpdate = Date.now() - session.updatedAt
    if (status === 'active') {
      if (timeSinceUpdate < 30000) return 'Working...'
      return 'Ready and listening'
    }
    if (status === 'supervising') {
      const subagentLabel = getActiveSubagentLabel(session, allSessions || [])
      return subagentLabel ? `Supervising: ${subagentLabel}` : 'Supervising subagent'
    }
    if (status === 'idle') return 'Waiting for tasks'
    return 'Sleeping 💤'
  }
  const latest = activities[0]
  const timeAgo = Date.now() - latest.timestamp
  if (timeAgo < 10000) {
    if (latest.type === 'tool_call') return `Working on ${latest.text}...`
    if (latest.type === 'thinking') return 'Thinking...'
    return 'Active now'
  }
  return latest.text
}

export function getTokenMeterLevel(tokens: number): number {
  if (tokens >= 50000) return 5
  if (tokens >= 20000) return 4
  if (tokens >= 10000) return 3
  if (tokens >= 5000) return 2
  if (tokens > 0) return 1
  return 0
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toString()
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

export function getSessionCost(session: MinionSession): number {
  if (!session.messages) return 0
  let total = 0
  for (const msg of session.messages) {
    if (msg.usage?.cost?.total) total += msg.usage.cost.total
  }
  return total
}

export function getMinionType(session: MinionSession): {
  type: string
  color: string
  emoji: string
} {
  const key = session.key || ''
  if (key === 'agent:main:main') return { type: 'Main Agent', color: '#FFA726', emoji: '🦞' }
  if (key.includes(':cron:')) return { type: 'Cron Worker', color: '#42A5F5', emoji: '⏰' }
  if (key.includes(':whatsapp:')) return { type: 'WhatsApp Bot', color: '#66BB6A', emoji: '📱' }
  if (key.includes(':spawn:') || key.includes(':subagent:'))
    return { type: 'Subagent', color: '#FFCA28', emoji: '⚡' }
  if (key.includes(':slack:')) return { type: 'Slack Bot', color: '#AB47BC', emoji: '💬' }
  if (key.includes(':telegram:')) return { type: 'Telegram Bot', color: '#29B6F6', emoji: '✈️' }
  return { type: 'Agent', color: '#9E9E9E', emoji: '🤖' }
}

export function getSessionDisplayName(session: MinionSession, customName?: string | null): string {
  // 1. Custom name from display names API
  if (customName) return customName
  // 2. Human-readable label (e.g. "crewhub-fix-3d-view", "hallo-laurens")
  if (session.label) return session.label
  const key = session.key || ''
  // 3. Fixed agents (agent:*:main) — use agent ID as display name
  const parts = key.split(':')
  if (parts.length === 3 && parts[0] === 'agent' && parts[2] === 'main') {
    const agentId = parts[1]
    const AGENT_NAMES: Record<string, string> = {
      main: 'Assistent',
      flowy: 'Flowy',
      creator: 'Creator',
      dev: 'Dev',
      reviewer: 'Reviewer',
      gamedev: 'Game Dev',
    }
    return AGENT_NAMES[agentId] || agentId.charAt(0).toUpperCase() + agentId.slice(1)
  }
  // 4. Cron sessions
  if (parts.length >= 4 && parts[2] === 'cron') return `Cron Worker ${parts[3].slice(0, 8)}`
  // 5. Friendly name for subagents
  if (key.includes(':subagent:') || key.includes(':spawn:')) return generateFriendlyName(key)
  // 6. Last resort: cleaned session key
  return parts.pop() || key
}

/**
 * Get the label/name of the most recently active subagent for a parent session.
 */
function getActiveSubagentLabel(
  session: MinionSession,
  allSessions: MinionSession[]
): string | null {
  const agentId = (session.key || '').split(':')[1]
  if (!agentId) return null

  const now = Date.now()
  const activeChildren = allSessions
    .filter((s) => {
      const parts = s.key.split(':')
      return (
        parts[1] === agentId &&
        (parts[2]?.includes('subagent') || parts[2]?.includes('spawn')) &&
        now - s.updatedAt < SESSION_CONFIG.statusActiveThresholdMs
      )
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)

  if (activeChildren.length === 0) return null
  const child = activeChildren[0]
  return child.label || generateFriendlyName(child.key)
}

export { getTaskEmoji, generateFriendlyName }

export function formatModel(model: string): string {
  return model
    .replace('anthropic/', '')
    .replace('openai-codex/', '')
    .replace('openai/', '')
    .replace('claude-', '')
    .replace('sonnet-', 'Sonnet ')
    .replace('opus-', 'Opus ')
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 10000) return 'Just now'
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}

export function getIdleTimeSeconds(session: MinionSession): number {
  return Math.floor((Date.now() - session.updatedAt) / 1000)
}

export function getIdleOpacity(idleSeconds: number): number {
  if (idleSeconds < 60) return 1.0
  if (idleSeconds < 120) return 0.8
  if (idleSeconds < 180) return 0.6
  if (idleSeconds < 240) return 0.4
  if (idleSeconds < 300) return 0.2
  return 0
}

/** Default parking idle threshold in seconds (reads from centralized config) */
export const DEFAULT_PARKING_IDLE_THRESHOLD = SESSION_CONFIG.parkingIdleThresholdS

export function shouldBeInParkingLane(
  session: MinionSession,
  isActivelyRunning?: boolean,
  idleThresholdSeconds: number = DEFAULT_PARKING_IDLE_THRESHOLD,
  allSessions?: MinionSession[]
): boolean {
  // Fixed agents (agent:*:main) always stay in their room
  if (/^agent:[a-zA-Z0-9_-]+:main$/.test(session.key)) return false

  // Issue 2 safeguard: sessions with non-active status from OpenClaw
  // should be parked immediately. Backend should filter these, but this is defensive.
  const rawStatus = session.status
  if (rawStatus && !['active', 'idle', ''].includes(rawStatus)) {
    return true // archived/pruned/completed → park immediately
  }

  const idleSeconds = getIdleTimeSeconds(session)
  const status = getSessionStatus(session, allSessions)
  // Supervising sessions should NOT be parked — they're actively delegating work
  if (status === 'supervising') return false
  if (status === 'sleeping') return true
  if (isActivelyRunning) return false

  // Issue 1 fix (v2026.2.17 — nested announce routing compensation):
  // Sub-subagent sessions don't get their updatedAt bumped by their own result announce
  // (the announce is routed to the parent session instead).
  // Check whether the parent main session recently received an update (proxy for: parent
  // received the announce routing) — if so, hold off parking the subagent.
  if (allSessions && (session.key.includes(':subagent:') || session.key.includes(':spawn:'))) {
    const keyParts = session.key.split(':')
    const agentId = keyParts[1]
    // Grace window = 2× parking threshold (240s by default)
    const ANNOUNCE_ROUTING_GRACE_MS = SESSION_CONFIG.parkingIdleThresholdS * 1000 * 2

    // Check parent main session
    const parentMainSession = allSessions.find((s) => s.key === `agent:${agentId}:main`)
    if (parentMainSession) {
      const parentAge = Date.now() - parentMainSession.updatedAt
      if (parentAge < ANNOUNCE_ROUTING_GRACE_MS) {
        return false // Parent recently updated → hold off parking
      }
    }
  }

  return idleSeconds > idleThresholdSeconds
}

// Backwards compatibility alias
export const getSessionType = getMinionType
