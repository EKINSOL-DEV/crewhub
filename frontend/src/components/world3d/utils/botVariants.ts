/**
 * Bot variant detection, color mapping, and type utilities for 3D bots.
 */

export type BotVariant = 'worker' | 'thinker' | 'cron' | 'comms' | 'dev'
export type BotExpression = 'happy' | 'thoughtful' | 'determined' | 'talking' | 'serious'
export type BotAccessoryType = 'crown' | 'lightbulb' | 'clock' | 'signal' | 'gear'
export type BotChestType = 'tool' | 'dots' | 'clock-display' | 'chat-dots' | 'code'

export interface BotVariantConfig {
  variant: BotVariant
  color: string
  accessory: BotAccessoryType
  expression: BotExpression
  chestDisplay: BotChestType
  icon: string
  label: string
}

// ─── Color mapping (from agent colors) ─────────────────────────

const VARIANT_CONFIGS: Record<BotVariant, BotVariantConfig> = {
  worker: {
    variant: 'worker',
    color: '#FE9600',
    accessory: 'crown',
    expression: 'happy',
    chestDisplay: 'tool',
    icon: '🔧',
    label: 'Worker',
  },
  thinker: {
    variant: 'thinker',
    color: '#1277C3',
    accessory: 'lightbulb',
    expression: 'thoughtful',
    chestDisplay: 'dots',
    icon: '💡',
    label: 'Thinker',
  },
  cron: {
    variant: 'cron',
    color: '#82B30E',
    accessory: 'clock',
    expression: 'determined',
    chestDisplay: 'clock-display',
    icon: '⏰',
    label: 'Cron',
  },
  comms: {
    variant: 'comms',
    color: '#9370DB',
    accessory: 'signal',
    expression: 'talking',
    chestDisplay: 'chat-dots',
    icon: '💬',
    label: 'Comms',
  },
  dev: {
    variant: 'dev',
    color: '#F32A1C',
    accessory: 'gear',
    expression: 'serious',
    chestDisplay: 'code',
    icon: '⚙️',
    label: 'Dev',
  },
}

// ─── Keyword-based detection ───────────────────────────────────

const VARIANT_KEYWORDS: { keywords: string[]; variant: BotVariant }[] = [
  { keywords: ['cron', 'schedule', 'timer'], variant: 'cron' },
  { keywords: ['dev', 'gamedev', 'code', 'engineer'], variant: 'dev' },
  { keywords: ['flowy', 'comms', 'comm', 'creator', 'slack', 'discord', 'whatsapp', 'telegram', 'chat'], variant: 'comms' },
  { keywords: ['think', 'thinker', 'research', 'analyst', 'reviewer', 'review'], variant: 'thinker' },
  { keywords: ['worker', 'main', 'build', 'deploy'], variant: 'worker' },
]

/**
 * Simple string hash to number (for deterministic variant fallback).
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

const ALL_VARIANTS: BotVariant[] = ['worker', 'thinker', 'cron', 'comms', 'dev']

/**
 * Detect bot variant from session key and label.
 * Falls back to a deterministic hash-based selection.
 */
export function detectBotVariant(sessionKey: string, label?: string): BotVariant {
  const searchText = `${sessionKey} ${label || ''}`.toLowerCase()

  for (const { keywords, variant } of VARIANT_KEYWORDS) {
    for (const kw of keywords) {
      if (searchText.includes(kw)) {
        return variant
      }
    }
  }

  // Fallback: use hash of session key for deterministic variant
  const hash = hashString(sessionKey)
  return ALL_VARIANTS[hash % ALL_VARIANTS.length]
}

/**
 * Get the full variant config for a bot.
 */
export function getBotVariantConfig(variant: BotVariant): BotVariantConfig {
  return VARIANT_CONFIGS[variant]
}

/**
 * Get variant config directly from session data.
 */
export function getBotConfigFromSession(sessionKey: string, label?: string, agentColor?: string | null): BotVariantConfig {
  const variant = detectBotVariant(sessionKey, label)
  const config = { ...VARIANT_CONFIGS[variant] }

  // If the agent has a custom color, use it
  if (agentColor) {
    config.color = agentColor
  }

  return config
}

/**
 * Determine if a session is a subagent (smaller bot).
 */
export function isSubagent(sessionKey: string): boolean {
  return sessionKey.includes(':subagent:') || sessionKey.includes(':spawn:')
}

/**
 * Get bot display name from session data.
 */
export function getBotDisplayName(sessionKey: string, displayName?: string, label?: string): string {
  if (displayName) return displayName
  if (label) {
    // Extract meaningful part from label
    const cleanLabel = label
      .replace(/parent=[^\s]+/g, '')
      .replace(/model=[^\s]+/g, '')
      .trim()
    if (cleanLabel.length > 0 && cleanLabel.length < 30) return cleanLabel
  }

  // Extract from session key: agent:name:type → name
  const parts = sessionKey.split(':')
  if (parts.length >= 2) {
    return parts[1]
  }
  return sessionKey.slice(0, 16)
}
