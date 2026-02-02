import type { CrewSession, SessionContentBlock } from "./api"

// Type aliases for backwards compatibility
type MinionSession = CrewSession
type MinionContentBlock = SessionContentBlock
import { getDisplayName, getTaskEmoji, generateFriendlyName } from "./friendlyNames"

export type SessionStatus = "active" | "idle" | "sleeping"

export interface ActivityEvent {
  timestamp: number
  type: "message" | "tool_call" | "thinking"
  icon: string
  text: string
  role?: "user" | "assistant" | "system"
}

export function getSessionStatus(session: MinionSession): SessionStatus {
  const timeSinceUpdate = Date.now() - session.updatedAt
  if (timeSinceUpdate < 5 * 60 * 1000) return "active"
  if (timeSinceUpdate < 30 * 60 * 1000) return "idle"
  return "sleeping"
}

export function getStatusIndicator(status: SessionStatus): { emoji: string; color: string; label: string } {
  switch (status) {
    case "active":
      return { emoji: "🟢", color: "text-green-500", label: "Active" }
    case "idle":
      return { emoji: "🟡", color: "text-yellow-500", label: "Idle" }
    case "sleeping":
      return { emoji: "💤", color: "text-gray-400", label: "Sleeping" }
  }
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
        if (block.type === "text" && block.text && block.text.trim()) {
          const text = block.text.trim()
          if (text === "NO_REPLY" || text === "HEARTBEAT_OK") continue
          activities.push({
            timestamp,
            type: "message",
            icon: msg.role === "user" ? "👤" : "🤖",
            text: text.length > 80 ? text.slice(0, 80) + "…" : text,
            role: msg.role as "user" | "assistant" | "system",
          })
        }
        if ((block.type === "toolCall" || block.type === "tool_use") && block.name) {
          const target = getToolTarget(block)
          activities.push({
            timestamp,
            type: "tool_call",
            icon: "🔧",
            text: target ? `${block.name} → ${target}` : block.name,
            role: "assistant",
          })
        }
        if (block.type === "thinking" && block.thinking) {
          activities.push({
            timestamp,
            type: "thinking",
            icon: "💭",
            text: block.thinking.length > 80 ? block.thinking.slice(0, 80) + "…" : block.thinking,
            role: "assistant",
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
    if (args.path && typeof args.path === "string") return extractFilename(args.path)
    if (args.file_path && typeof args.file_path === "string") return extractFilename(args.file_path)
    if (args.url && typeof args.url === "string") return extractDomain(args.url)
    if (args.command && typeof args.command === "string") return args.command.split(" ")[0]
    return null
  } catch {
    return null
  }
}

function extractFilename(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function getCurrentActivity(session: MinionSession): string {
  const activities = parseRecentActivities(session, 1)
  if (activities.length === 0) {
    const status = getSessionStatus(session)
    const timeSinceUpdate = Date.now() - session.updatedAt
    if (status === "active") {
      if (timeSinceUpdate < 30000) return "Working..."
      return "Ready and listening"
    }
    if (status === "idle") return "Waiting for tasks"
    return "Sleeping 💤"
  }
  const latest = activities[0]
  const timeAgo = Date.now() - latest.timestamp
  if (timeAgo < 10000) {
    if (latest.type === "tool_call") return `Working on ${latest.text}...`
    if (latest.type === "thinking") return "Thinking..."
    return "Active now"
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

export function getMinionType(session: MinionSession): { type: string; color: string; emoji: string } {
  const key = session.key || ""
  if (key === "agent:main:main") return { type: "Main Agent", color: "#FFA726", emoji: "🦞" }
  if (key.includes(":cron:")) return { type: "Cron Worker", color: "#42A5F5", emoji: "⏰" }
  if (key.includes(":whatsapp:")) return { type: "WhatsApp Bot", color: "#66BB6A", emoji: "📱" }
  if (key.includes(":spawn:") || key.includes(":subagent:")) return { type: "Subagent", color: "#FFCA28", emoji: "⚡" }
  if (key.includes(":slack:")) return { type: "Slack Bot", color: "#AB47BC", emoji: "💬" }
  if (key.includes(":telegram:")) return { type: "Telegram Bot", color: "#29B6F6", emoji: "✈️" }
  return { type: "Agent", color: "#9E9E9E", emoji: "🤖" }
}

export function getSessionDisplayName(session: MinionSession, customName?: string | null): string {
  if (customName) return customName
  if (session.displayName) {
    return session.displayName
      .replace("webchat:g-agent-main-main", "Main Agent")
      .replace("whatsapp:g-", "")
      .replace("slack:g-", "")
      .replace("slack:#", "#")
  }
  const key = session.key || ""
  if (key === "agent:main:main") return "Main Agent"
  const parts = key.split(":")
  if (parts.length >= 4 && parts[2] === "cron") return `Cron Worker ${parts[3].slice(0, 8)}`
  return getDisplayName(session)
}

export { getTaskEmoji, generateFriendlyName }

export function formatModel(model: string): string {
  return model
    .replace("anthropic/", "")
    .replace("openai-codex/", "")
    .replace("openai/", "")
    .replace("claude-", "")
    .replace("sonnet-", "Sonnet ")
    .replace("opus-", "Opus ")
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 10000) return "Just now"
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

export function shouldBeInParkingLane(session: MinionSession, isActivelyRunning?: boolean): boolean {
  const idleSeconds = getIdleTimeSeconds(session)
  const status = getSessionStatus(session)
  if (status === "sleeping") return true
  if (isActivelyRunning) return false
  return idleSeconds > 30
}

// Backwards compatibility alias
export const getSessionType = getMinionType
