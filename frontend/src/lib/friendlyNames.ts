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

export function generateFriendlyName(sessionKey: string): string {
  const hash = sessionKey.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)
  const adj = adjectives[Math.abs(hash) % adjectives.length]
  const noun = nouns[Math.abs(hash >> 8) % nouns.length]
  return `${adj}-${noun}`
}

export function getMinionName(sessionKey: string, roomId: string): string {
  const names = MINION_NAMES[roomId]
  if (!names || names.length === 0) return MINION_NAMES.headquarters[0] || 'Agent'
  const hash = Math.abs(sessionKey.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0))
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
  // Known owner phone numbers - always include
  if (sessionKey.includes('+32494330227') || sessionKey.includes('+32469774873')) {
    return true
  }

  // Agent session keys: agent:name:type:uuid
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.split(':')
    // Exclude subagent and spawn sessions
    if (parts.includes('subagent') || parts.includes('spawn')) {
      return false
    }
    // Include main sessions (agent:dev:main, agent:main:main, etc.)
    if (parts.includes('main')) {
      return true
    }
    // If it's just agent:name format (no subagent/spawn), include it
    if (parts.length === 2) {
      return true
    }
    return false
  }

  // WhatsApp session keys
  if (sessionKey.startsWith('whatsapp:')) {
    const payload = sessionKey.slice('whatsapp:'.length)

    // Exclude subagent patterns
    if (payload.includes('-subagent-') || payload.includes('-spawn-')) {
      return false
    }

    // Include known phone numbers
    if (payload.includes('+32494330227') || payload.includes('+32469774873')) {
      return true
    }

    // Include g-agent-{name}-main patterns
    if (payload.match(/^g-agent-\w+-main/)) {
      return true
    }

    return false
  }

  // Plain phone numbers - include known ones
  if (sessionKey.match(/^\+\d+$/)) {
    return sessionKey === '+32494330227' || sessionKey === '+32469774873'
  }

  return false
}

export function formatSessionKeyAsName(sessionKey: string, label?: string): string {
  // Priority 1: If we have a label, use it
  if (label) return label

  // Priority 2: Known phone numbers
  if (sessionKey.includes('+32494330227')) return 'Nicky'
  if (sessionKey.includes('+32469774873')) return 'Ekinbot'

  // Priority 3: Parse agent session keys (agent:name:type:uuid)
  if (sessionKey.startsWith('agent:')) {
    const parts = sessionKey.split(':')
    if (parts.length >= 2) {
      const agentName = parts[1]
      const capitalizedName = agentName.charAt(0).toUpperCase() + agentName.slice(1)

      // Check if it's a subagent
      if (parts.includes('subagent') || parts.includes('spawn')) {
        return `${capitalizedName} (subagent)`
      }
      return capitalizedName
    }
  }

  // Priority 4: WhatsApp session keys (whatsapp:g-agent-name-subagent-xxx)
  if (sessionKey.startsWith('whatsapp:')) {
    const payload = sessionKey.slice('whatsapp:'.length)

    // Parse g-agent-{name}-subagent-xxx format
    const gAgentMatch = payload.match(/^g-agent-(\w+)-subagent-/)
    if (gAgentMatch) {
      const agentName = gAgentMatch[1]
      const capitalizedName = agentName.charAt(0).toUpperCase() + agentName.slice(1)
      return `${capitalizedName} (subagent)`
    }

    // Parse g-agent-{name}-main format
    const gMainMatch = payload.match(/^g-agent-(\w+)-main/)
    if (gMainMatch) {
      const agentName = gMainMatch[1]
      return agentName.charAt(0).toUpperCase() + agentName.slice(1)
    }

    // Phone number in WhatsApp key
    const phoneMatch = payload.match(/\+\d+/)
    if (phoneMatch) {
      if (phoneMatch[0] === '+32494330227') return 'Nicky'
      if (phoneMatch[0] === '+32469774873') return 'Ekinbot'
      return `User (${phoneMatch[0].slice(0, 6)}...)`
    }

    // Fallback: show first part
    return payload.split('-')[0] || 'WhatsApp'
  }

  // Priority 5: Plain phone number
  const phoneMatch = sessionKey.match(/\+\d+/)
  if (phoneMatch) {
    if (phoneMatch[0] === '+32494330227') return 'Nicky'
    if (phoneMatch[0] === '+32469774873') return 'Ekinbot'
    return `User (${phoneMatch[0].slice(0, 6)}...)`
  }

  // Priority 6: Extract last meaningful part
  const parts = sessionKey.split(':')
  const lastPart = parts[parts.length - 1]

  // If last part is a UUID, try the second-to-last
  if (lastPart.match(/^[a-f0-9-]{36}$/i) && parts.length > 1) {
    return parts[parts.length - 2]
  }

  return lastPart || sessionKey
}
