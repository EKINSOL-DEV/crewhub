const PHONE_32469774873 = '+32469774873'
const PHONE_32494330227 = '+32494330227'

const adjectives = [
  'brave',
  'swift',
  'happy',
  'clever',
  'sunny',
  'mighty',
  'gentle',
  'bold',
  'cosmic',
  'turbo',
]
const nouns = [
  'banana',
  'lobster',
  'wrench',
  'rocket',
  'coconut',
  'penguin',
  'dolphin',
  'phoenix',
  'wizard',
  'ninja',
]

const MINION_NAMES: Record<string, string[]> = {
  dev: ['Kevin', 'Stuart', 'Dave', 'Jerry', 'Tim', 'Mark', 'Phil', 'Carl'],
  thinking: ['Einstein', 'Newton', 'Plato', 'Socrates', 'Darwin', 'Curie', 'Hawking', 'Turing'],
  creative: ['Picasso', 'Banksy', 'Warhol', 'Dali', 'Frida', 'Monet', 'Rembrandt', 'Escher'],
  marketing: ['Madison', 'Sterling', 'Peggy', 'Don', 'Cooper', 'Draper', 'Olson', 'Campbell'],
  automation: ['Cron', 'Timer', 'Tick', 'Pulse', 'Batch', 'Loop', 'Trigger', 'Schedule'],
  comms: ['Hermes', 'Mercury', 'Iris', 'Gabriel', 'Messenger', 'Herald', 'Courier', 'Swift'],
  ops: ['Docker', 'Kube', 'Helm', 'Terraform', 'Ansible', 'Chef', 'Puppet', 'Jenkins'],
  headquarters: ['Boss', 'Chief', 'Captain', 'Admiral', 'General', 'Commander', 'Director', 'Lead'],
}

const KNOWN_PHONES: Record<string, string> = {
  PHONE_32494330227: 'Nicky',
  PHONE_32469774873: 'Ekinbot',
}

export function generateFriendlyName(sessionKey: string): string {
  const hash = sessionKey.split('').reduce((a, b) => (a << 5) - a + (b.codePointAt(0) ?? 0), 0)
  const adj = adjectives[Math.abs(hash) % adjectives.length]
  const noun = nouns[Math.abs(hash >> 8) % nouns.length]
  return `${adj}-${noun}`
}

export function getMinionName(sessionKey: string, roomId: string): string {
  const names = MINION_NAMES[roomId]
  if (!names || names.length === 0) return MINION_NAMES.headquarters[0] || 'Agent'
  const hash = Math.abs(
    sessionKey.split('').reduce((a, b) => (a << 5) - a + (b.codePointAt(0) ?? 0), 0)
  )
  return names[hash % names.length]
}

export function getTaskEmoji(label?: string): string {
  if (!label) return '🤖'
  const l = label.toLowerCase()
  if (l.includes('fix') || l.includes('bug')) return '🔧'
  if (l.includes('feature') || l.includes('implement')) return '✨'
  if (l.includes('research') || l.includes('analys')) return '🔍'
  if (l.includes('test') || l.includes('qa')) return '🧪'
  if (l.includes('refactor')) return '♻️'
  return '🤖'
}

export function getDisplayName(session: { key: string; label?: string }): string {
  if (session.label) return session.label
  if (session.key.includes(':subagent:')) return generateFriendlyName(session.key)
  return session.key.split(':').pop() || session.key
}

// ── Helpers ───────────────────────────────────────────────────

function containsKnownPhone(key: string): boolean {
  return key.includes(PHONE_32494330227) || key.includes(PHONE_32469774873)
}

function isFixedAgentKey(sessionKey: string): boolean {
  const parts = sessionKey.split(':')
  if (parts.includes('subagent') || parts.includes('spawn')) return false
  if (parts.includes('main')) return true
  if (parts.length === 2) return true
  return false
}

function isFixedWhatsAppPayload(payload: string): boolean {
  if (payload.includes('-subagent-') || payload.includes('-spawn-')) return false
  if (payload.includes(PHONE_32494330227) || payload.includes(PHONE_32469774873)) return true
  if (/^g-agent-\w+-main/.exec(payload)) return true
  return false
}

// ── Public API ────────────────────────────────────────────────

/**
 * Get a user-friendly display name from a session key.
 * Handles various formats:
 * - agent:dev:subagent:xxx → "Dev (subagent)"
 * - agent:main:main → "Main"
 * - whatsapp:g-agent-dev-subagent-xxx → "Dev (subagent)"
 * - +32494330227 → "Nicky" (known number) or "User (+32...)"
 * - etc.
 */
/**
 * Check if a session key represents a fixed/permanent agent.
 * Fixed agents are persistent and should appear in dropdowns.
 * Temporary subagents should be excluded.
 */
export function isFixedAgent(sessionKey: string): boolean {
  if (containsKnownPhone(sessionKey)) return true

  if (sessionKey.startsWith('agent:')) return isFixedAgentKey(sessionKey)

  if (sessionKey.startsWith('whatsapp:')) {
    return isFixedWhatsAppPayload(sessionKey.slice('whatsapp:'.length))
  }

  if (/^\+\d+$/.exec(sessionKey)) {
    return sessionKey === PHONE_32494330227 || sessionKey === PHONE_32469774873
  }

  return false
}

function resolvePhoneToName(phone: string): string | null {
  return KNOWN_PHONES[phone] ?? null
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function parseAgentSessionKey(sessionKey: string): string {
  const parts = sessionKey.split(':')
  if (parts.length < 2) return sessionKey
  const agentName = parts[1]
  const capitalized = capitalizeFirst(agentName)
  if (parts.includes('subagent') || parts.includes('spawn')) {
    return `${capitalized} (subagent)`
  }
  return capitalized
}

function parseWhatsAppSessionKey(payload: string): string {
  const gSubMatch = /^g-agent-(\w+)-subagent-/.exec(payload)
  if (gSubMatch) return `${capitalizeFirst(gSubMatch[1])} (subagent)`

  const gMainMatch = /^g-agent-(\w+)-main/.exec(payload)
  if (gMainMatch) return capitalizeFirst(gMainMatch[1])

  const phoneMatch = /\+\d+/.exec(payload)
  if (phoneMatch) {
    const name = resolvePhoneToName(phoneMatch[0])
    if (name) return name
    return `User (${phoneMatch[0].slice(0, 6)}...)`
  }

  return payload.split('-')[0] || 'WhatsApp'
}

export function formatSessionKeyAsName(sessionKey: string, label?: string): string {
  if (label) return label

  // Known phone numbers (direct or embedded)
  for (const [phone, name] of Object.entries(KNOWN_PHONES)) {
    if (sessionKey.includes(phone)) return name
  }

  if (sessionKey.startsWith('agent:')) return parseAgentSessionKey(sessionKey)

  if (sessionKey.startsWith('whatsapp:')) {
    return parseWhatsAppSessionKey(sessionKey.slice('whatsapp:'.length))
  }

  const phoneMatch = /\+\d+/.exec(sessionKey)
  if (phoneMatch) {
    const name = resolvePhoneToName(phoneMatch[0])
    if (name) return name
    return `User (${phoneMatch[0].slice(0, 6)}...)`
  }

  const parts = sessionKey.split(':')
  const lastPart = parts[parts.length - 1]
  if (/^[a-f0-9-]{36}$/i.exec(lastPart) && parts.length > 1) {
    return parts[parts.length - 2]
  }

  return lastPart || sessionKey
}
