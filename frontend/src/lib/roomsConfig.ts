export interface Room {
  id: string
  name: string
  icon?: string
  color?: string
  order: number
}

export interface BotRoomAssignment {
  botSessionKey: string
  roomId: string
  assignedAt: number
}

export interface RoomsConfig {
  rooms: Room[]
  assignments: BotRoomAssignment[]
  layoutMode: "auto" | "grid"
  gridColumns: number
  showRoomLabels: boolean
  showRoomBorders: boolean
  unassignedRoomId?: string
}

interface StoredRoomsConfig {
  version: number
  config: RoomsConfig
  lastModified: number
}

export const DEFAULT_ROOMS: Room[] = [
  { id: "headquarters", name: "Headquarters", icon: "🏛️", color: "#4f46e5", order: 0 },
  { id: "marketing-room", name: "Marketing", icon: "📢", color: "#ec4899", order: 1 },
  { id: "dev-room", name: "Dev Room", icon: "💻", color: "#10b981", order: 2 },
  { id: "creative-room", name: "Creative Room", icon: "🎨", color: "#f59e0b", order: 3 },
  { id: "thinking-room", name: "Thinking Room", icon: "🧠", color: "#8b5cf6", order: 4 },
  { id: "automation-room", name: "Automation Room", icon: "⚙️", color: "#06b6d4", order: 5 },
  { id: "comms-room", name: "Comms Room", icon: "📡", color: "#14b8a6", order: 6 },
  { id: "ops-room", name: "Ops Room", icon: "🛠️", color: "#f97316", order: 7 },
]

export const DEFAULT_ROOMS_CONFIG: RoomsConfig = {
  rooms: DEFAULT_ROOMS,
  assignments: [],
  layoutMode: "grid",
  gridColumns: 4,
  showRoomLabels: true,
  showRoomBorders: true,
  unassignedRoomId: "headquarters",
}

const STORAGE_KEY = "clawcrew-rooms-config"
const CONFIG_VERSION = 1

export function loadRoomsConfig(): RoomsConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      saveRoomsConfig(DEFAULT_ROOMS_CONFIG)
      return DEFAULT_ROOMS_CONFIG
    }
    const parsed: StoredRoomsConfig = JSON.parse(stored)
    return parsed.config
  } catch {
    return DEFAULT_ROOMS_CONFIG
  }
}

export function saveRoomsConfig(config: RoomsConfig): { success: boolean; error?: string } {
  try {
    const stored: StoredRoomsConfig = { version: CONFIG_VERSION, config, lastModified: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    window.dispatchEvent(new CustomEvent("roomsConfigUpdated"))
    return { success: true }
  } catch (error) {
    return { success: false, error: "Failed to save settings" }
  }
}

const PERSONA_ROOM_DEFAULTS: Record<string, string> = {
  "agent:main:main": "headquarters",
  "agent:whatsapp:main": "comms-room",
  "agent:telegram:main": "comms-room",
  "agent:slack:main": "comms-room",
  "agent:discord:main": "comms-room",
}

export function getRoomForSession(
  sessionKey: string,
  config: RoomsConfig,
  sessionData?: { label?: string; model?: string }
): string {
  if (sessionKey.includes(":cron:")) return "automation-room"
  const personaDefault = PERSONA_ROOM_DEFAULTS[sessionKey]
  if (personaDefault) return personaDefault
  
  const isSubagent = sessionKey.includes(":subagent:")
  if (isSubagent) {
    const parentKey = sessionKey.split(":subagent:")[0]
    const parentAssignment = config.assignments.find(a => a.botSessionKey === parentKey)
    if (parentAssignment) return parentAssignment.roomId
    if (sessionData) return autoAssignRoom(sessionKey, sessionData, config)
  } else {
    const assignment = config.assignments.find(a => a.botSessionKey === sessionKey)
    if (assignment) return assignment.roomId
  }
  return config.unassignedRoomId || config.rooms[0]?.id || "headquarters"
}

function autoAssignRoom(sessionKey: string, sessionData: { label?: string; model?: string }, config: RoomsConfig): string {
  const label = (sessionData.label || "").toLowerCase()
  const model = sessionData.model || ""
  
  if (sessionKey.includes(":cron:")) return "automation-room"
  if (model.includes("opus") || model.includes("claude-opus")) return "dev-room"
  if (model.includes("gpt5") || model.includes("gpt-5")) return "thinking-room"
  
  const thinkingKeywords = ["analyse", "analysis", "review", "design doc", "architecture", "research", "evaluate"]
  const devKeywords = ["implement", "fix", "bug", "refactor", "build", "deploy", "code", "api", "feature"]
  const marketingKeywords = ["copy", "seo", "newsletter", "landing page", "content", "marketing"]
  const creativeKeywords = ["experiment", "poc", "brainstorm", "try", "explore", "design", "creative", "art"]
  const automationKeywords = ["cron", "schedule", "reminder", "timer", "job"]
  const commsKeywords = ["email", "slack", "whatsapp", "message", "notify", "send"]
  const opsKeywords = ["deploy", "docker", "monitor", "server", "devops", "infrastructure"]
  
  if (thinkingKeywords.some(kw => label.includes(kw))) return "thinking-room"
  if (devKeywords.some(kw => label.includes(kw)) && !label.includes("review")) return "dev-room"
  if (marketingKeywords.some(kw => label.includes(kw))) return "marketing-room"
  if (creativeKeywords.some(kw => label.includes(kw))) return "creative-room"
  if (automationKeywords.some(kw => label.includes(kw))) return "automation-room"
  if (commsKeywords.some(kw => label.includes(kw))) return "comms-room"
  if (opsKeywords.some(kw => label.includes(kw))) return "ops-room"
  
  return config.unassignedRoomId || "headquarters"
}
