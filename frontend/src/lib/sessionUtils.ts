import type { MinionSession } from "./api"

export function isSubagent(sessionKey: string): boolean {
  return sessionKey.includes(":subagent:") || sessionKey.includes(":spawn:")
}

export function getParentSessionKey(sessionKey: string): string | null {
  if (!isSubagent(sessionKey)) return null
  const parts = sessionKey.split(":")
  if (parts.length < 4) return null
  if (parts[0] === "agent" && parts[1] === "main") return "agent:main:main"
  const parentBase = parts.slice(0, 2).join(":")
  return `${parentBase}:${parts[1]}`
}

export function findParentSession(sessionKey: string, allSessions: MinionSession[]): MinionSession | null {
  const parentKey = getParentSessionKey(sessionKey)
  if (!parentKey) return null
  return allSessions.find(s => s.key === parentKey) || null
}

export function getChildSessions(parentKey: string, allSessions: MinionSession[]): MinionSession[] {
  return allSessions.filter(s => {
    const parent = getParentSessionKey(s.key)
    return parent === parentKey
  })
}
