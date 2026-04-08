/* eslint-disable sonarjs/cognitive-complexity */
/**
 * Bot status and activity text utilities.
 * Pure functions — no React imports.
 */
import type { CrewSession } from '@/lib/api'
import type { BotStatus } from '../botConstants'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { hasActiveSubagents } from '@/lib/minionUtils'
import { isCCActive } from '@/lib/ccStatus'

// ─── Bot Status ────────────────────────────────────────────────

export function getAccurateBotStatus(
  session: CrewSession,
  isActive: boolean,
  allSessions?: CrewSession[]
): BotStatus {
  // Claude Code sessions: use explicit status directly
  if (session.source === 'claude_code') {
    const status = session.status
    if (status === 'waiting_permission') return 'waiting_permission'
    if (isCCActive(status)) return 'active'
    if (status === 'waiting_input') return 'idle'
    // Synthetic session (no watcher data) — show idle, not offline
    if (!status) return 'idle'
    // idle/unknown: age-based
    const idleMs = Date.now() - session.updatedAt
    if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
    return 'offline'
  }
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (allSessions && hasActiveSubagents(session, allSessions)) return 'supervising'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

// ─── Activity Text ─────────────────────────────────────────────

/**
 * Convert a kebab-case or snake_case label into a human-readable summary.
 * e.g. "fix-wall-alignment" → "Fixing wall alignment"
 */
export function humanizeLabel(label: string): string {
  const text = label.replaceAll(/[-_]+/g, ' ').trim()
  if (!text) return ''

  const gerundMap: Record<string, string> = {
    fix: 'Fixing',
    review: 'Reviewing',
    write: 'Writing',
    build: 'Building',
    add: 'Adding',
    update: 'Updating',
    debug: 'Debugging',
    test: 'Testing',
    refactor: 'Refactoring',
    deploy: 'Deploying',
    check: 'Checking',
    create: 'Creating',
    implement: 'Implementing',
    remove: 'Removing',
    delete: 'Deleting',
    move: 'Moving',
    merge: 'Merging',
    setup: 'Setting up',
    clean: 'Cleaning',
    analyze: 'Analyzing',
    design: 'Designing',
    optimize: 'Optimizing',
    migrate: 'Migrating',
    scan: 'Scanning',
    fetch: 'Fetching',
    parse: 'Parsing',
    monitor: 'Monitoring',
    install: 'Installing',
    configure: 'Configuring',
    research: 'Researching',
  }

  const words = text.split(' ')
  const firstWord = words[0].toLowerCase()
  if (gerundMap[firstWord]) {
    words[0] = gerundMap[firstWord]
  } else {
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1)
  }

  const acronyms = new Set([
    'pr',
    'ui',
    'ux',
    'api',
    'css',
    'html',
    'db',
    'ci',
    'cd',
    'ssr',
    'seo',
    'jwt',
    'sdk',
  ])
  for (let i = 1; i < words.length; i++) {
    if (acronyms.has(words[i].toLowerCase())) {
      words[i] = words[i].toUpperCase()
    }
  }

  return words.join(' ')
}

/**
 * Extract a short task summary from the last few messages.
 */
function getContentFlags(content: unknown): { toolCall: string | null; thinking: boolean } {
  if (!Array.isArray(content)) return { toolCall: null, thinking: false }

  let toolCall: string | null = null
  let thinking = false

  for (const block of content) {
    if (
      !toolCall &&
      (block.type === 'toolCall' || block.type === 'tool_use') &&
      typeof block.name === 'string'
    ) {
      toolCall = block.name
    }
    if (!thinking && block.type === 'thinking') {
      thinking = true
    }
    if (toolCall && thinking) break
  }

  return { toolCall, thinking }
}

function getRecentActivityFlags(messages: CrewSession['messages'] = []) {
  const recent = messages.slice(-5).reverse()
  let lastToolCall: string | null = null
  let isThinking = false

  for (const msg of recent) {
    const { toolCall, thinking } = getContentFlags(msg?.content)
    if (!lastToolCall && toolCall) lastToolCall = toolCall
    if (!isThinking && thinking) isThinking = true
    if (lastToolCall && isThinking) break
  }

  return { lastToolCall, isThinking }
}

export function extractTaskSummary(messages: CrewSession['messages']): string | null {
  if (!messages || messages.length === 0) return null

  const { lastToolCall, isThinking } = getRecentActivityFlags(messages)
  if (isThinking && !lastToolCall) return '💭 Thinking…'
  if (lastToolCall) return `🔧 ${lastToolCall}`
  return null
}

export function getActivityText( // NOSONAR: complexity from legitimate activity state branching
  session: CrewSession,
  isActive: boolean,
  allSessions?: CrewSession[]
): string {
  // Claude Code sessions: use explicit status for activity text
  if (session.source === 'claude_code') {
    switch (session.status) {
      case 'tool_use':
        return session.activityDetail ? `🔧 ${session.activityDetail}` : '🔧 Using tools…'
      case 'responding':
        return '💬 Responding…'
      case 'waiting_permission':
        return '🔐 Waiting for permission…'
      case 'waiting_input':
        return '⏳ Waiting for input'
      default:
        return '💤 Idle'
    }
  }

  if (!isActive && allSessions && hasActiveSubagents(session, allSessions)) {
    const agentId = (session.key || '').split(':')[1]
    const now = Date.now()
    const activeChild = allSessions
      .filter((s) => {
        const parts = s.key.split(':')
        return (
          parts[1] === agentId &&
          (parts[2]?.includes('subagent') || parts[2]?.includes('spawn')) &&
          now - s.updatedAt < SESSION_CONFIG.statusActiveThresholdMs
        )
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (activeChild) {
      const label = activeChild.label ? humanizeLabel(activeChild.label) : 'subagent'
      return `👁️ Supervising: ${label}`
    }
    return '👁️ Supervising subagent'
  }

  if (isActive) {
    if (session.label) {
      const humanized = humanizeLabel(session.label)
      if (humanized) return humanized.endsWith('…') ? humanized : humanized + '…'
    }
    const messageSummary = extractTaskSummary(session.messages)
    if (messageSummary) return messageSummary
    return 'Working…'
  }

  if (session.label) {
    const humanized = humanizeLabel(session.label)
    if (humanized) return `✅ ${humanized}`
  }

  return '💤 Idle'
}
