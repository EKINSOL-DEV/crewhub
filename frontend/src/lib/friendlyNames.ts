const adjectives = ["brave", "swift", "happy", "clever", "sunny", "mighty", "gentle", "bold", "cosmic", "turbo"]
const nouns = ["banana", "lobster", "wrench", "rocket", "coconut", "penguin", "dolphin", "phoenix", "wizard", "ninja"]

const MINION_NAMES: Record<string, string[]> = {
  dev: ["Kevin", "Stuart", "Dave", "Jerry", "Tim", "Mark", "Phil", "Carl"],
  thinking: ["Einstein", "Newton", "Plato", "Socrates", "Darwin", "Curie", "Hawking", "Turing"],
  creative: ["Picasso", "Banksy", "Warhol", "Dali", "Frida", "Monet", "Rembrandt", "Escher"],
  marketing: ["Madison", "Sterling", "Peggy", "Don", "Cooper", "Draper", "Olson", "Campbell"],
  automation: ["Cron", "Timer", "Tick", "Pulse", "Batch", "Loop", "Trigger", "Schedule"],
  comms: ["Hermes", "Mercury", "Iris", "Gabriel", "Messenger", "Herald", "Courier", "Swift"],
  ops: ["Docker", "Kube", "Helm", "Terraform", "Ansible", "Chef", "Puppet", "Jenkins"],
  headquarters: ["Boss", "Chief", "Captain", "Admiral", "General", "Commander", "Director", "Lead"],
}

export function generateFriendlyName(sessionKey: string): string {
  const hash = sessionKey.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)
  const adj = adjectives[Math.abs(hash) % adjectives.length]
  const noun = nouns[Math.abs(hash >> 8) % nouns.length]
  return `${adj}-${noun}`
}

export function getMinionName(sessionKey: string, roomId: string): string {
  const names = MINION_NAMES[roomId]
  if (!names || names.length === 0) return MINION_NAMES.headquarters[0] || "Agent"
  const hash = Math.abs(sessionKey.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))
  return names[hash % names.length]
}

export function getTaskEmoji(label?: string): string {
  if (!label) return "🤖"
  const l = label.toLowerCase()
  if (l.includes("fix") || l.includes("bug")) return "🔧"
  if (l.includes("feature") || l.includes("implement")) return "✨"
  if (l.includes("research") || l.includes("analys")) return "🔍"
  if (l.includes("test") || l.includes("qa")) return "🧪"
  if (l.includes("refactor")) return "♻️"
  return "🤖"
}

export function getDisplayName(session: {key: string, label?: string}): string {
  if (session.label) return session.label
  if (session.key.includes(":subagent:")) return generateFriendlyName(session.key)
  return session.key.split(":").pop() || session.key
}
