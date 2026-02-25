/**
 * Pixel Avatar Patterns
 * 8x8 grid designs for each agent type and animation state
 *
 * Values:
 * 0 = transparent
 * 1 = base color (agent primary)
 * 2 = highlight (white/light)
 * 3 = dark shade (darker version of base)
 * 4 = accent (eyes, details)
 */

export type PixelValue = 0 | 1 | 2 | 3 | 4
export type PixelGrid = PixelValue[][]

export type AgentType = 'worker' | 'dev' | 'comms' | 'thinker' | 'cron'
export type AnimationState = 'idle' | 'thinking' | 'typing' | 'error'

// Agent color configurations
export const AGENT_COLORS: Record<AgentType, { base: string; dark: string; accent: string }> = {
  worker: {
    base: '#FE9600',
    dark: '#CC7800',
    accent: '#FFB84D',
  },
  dev: {
    base: '#F32A1C',
    dark: '#C42016',
    accent: '#FF5A4D',
  },
  comms: {
    base: '#9370DB',
    dark: '#7B5FC4',
    accent: '#B8A1E8',
  },
  thinker: {
    base: '#1277C3',
    dark: '#0E5A94',
    accent: '#4A9FDE',
  },
  cron: {
    base: '#82B30E',
    dark: '#668C0B',
    accent: '#A3D43A',
  },
}

// ─── Idle Pattern ───────────────────────────────────────────────
// Happy robot face with antenna
const IDLE_PATTERN: PixelGrid = [
  [0, 0, 0, 1, 1, 0, 0, 0], // antenna
  [0, 1, 1, 1, 1, 1, 1, 0], // top of head
  [1, 1, 2, 1, 1, 2, 1, 1], // eyes (highlight)
  [1, 1, 1, 1, 1, 1, 1, 1], // face
  [1, 1, 1, 3, 3, 1, 1, 1], // nose/center
  [1, 1, 4, 4, 4, 4, 1, 1], // mouth (accent = smile)
  [1, 1, 1, 1, 1, 1, 1, 1], // chin
  [0, 1, 1, 0, 0, 1, 1, 0], // bottom
]

// ─── Thinking Pattern ───────────────────────────────────────────
// Eyes looking up, thinking dots
const THINKING_PATTERN: PixelGrid = [
  [0, 0, 2, 1, 1, 2, 0, 0], // thinking sparkles
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 2, 1, 1, 1, 1, 2, 1], // eyes looking up
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 3, 3, 1, 1, 1],
  [1, 1, 1, 4, 4, 1, 1, 1], // small mouth (concentrating)
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
]

// ─── Thinking Alt (for blink animation) ─────────────────────────
const THINKING_BLINK: PixelGrid = [
  [0, 2, 0, 1, 1, 0, 2, 0], // sparkle positions swapped
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 3, 3, 3, 3, 1, 1], // eyes closed (horizontal lines)
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 3, 3, 1, 1, 1],
  [1, 1, 1, 4, 4, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
]

// ─── Typing Pattern ─────────────────────────────────────────────
// Active talking, mouth open
const TYPING_PATTERN: PixelGrid = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 2, 1, 1, 2, 1, 1], // eyes
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 4, 3, 3, 4, 1, 1], // open mouth
  [1, 1, 1, 4, 4, 1, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
]

// ─── Typing Alt (mouth animation) ───────────────────────────────
const TYPING_ALT: PixelGrid = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 2, 1, 1, 2, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 4, 4, 1, 1, 1], // smaller mouth
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
]

// ─── Error Pattern ──────────────────────────────────────────────
// X eyes, worried expression
const ERROR_PATTERN: PixelGrid = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 3, 1, 3, 3, 1, 3, 1], // X eyes
  [1, 1, 3, 1, 1, 3, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 3, 3, 1, 1, 1], // frown
  [1, 1, 3, 1, 1, 3, 1, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
]

// ─── Pattern Collections ────────────────────────────────────────

export const PATTERNS: Record<AnimationState, PixelGrid[]> = {
  idle: [IDLE_PATTERN],
  thinking: [THINKING_PATTERN, THINKING_BLINK],
  typing: [TYPING_PATTERN, TYPING_ALT],
  error: [ERROR_PATTERN],
}

/**
 * Get pattern for a specific state and frame
 */
export function getPattern(state: AnimationState, frame: number = 0): PixelGrid {
  const patterns = PATTERNS[state]
  return patterns[frame % patterns.length]
}

/**
 * Map agent name to agent type
 */
export function getAgentType(agentName: string | null): AgentType {
  if (!agentName) return 'worker'

  const name = agentName.toLowerCase()

  if (name.includes('dev') || name.includes('code')) return 'dev'
  if (
    name.includes('flow') ||
    name.includes('creator') ||
    name.includes('slack') ||
    name.includes('discord')
  )
    return 'comms'
  if (name.includes('review') || name.includes('think') || name.includes('analyst'))
    return 'thinker'
  if (name.includes('cron') || name.includes('schedule')) return 'cron'

  return 'worker' // default: Assistent
}

/**
 * Get colors for an agent type
 */
export function getAgentColors(type: AgentType) {
  return AGENT_COLORS[type]
}
