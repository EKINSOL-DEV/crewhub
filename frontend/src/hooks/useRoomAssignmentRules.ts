import { useState, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/api"

export interface RoomAssignmentRule {
  id: string
  room_id: string
  rule_type: "keyword" | "model" | "label_pattern" | "session_type" | "session_key_contains"
  rule_value: string
  priority: number
  created_at: number
}

interface RulesResponse {
  rules: RoomAssignmentRule[]
}

/**
 * Hook to fetch and manage room assignment rules.
 * Rules are sorted by priority (highest first).
 */
export function useRoomAssignmentRules() {
  const [rules, setRules] = useState<RoomAssignmentRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/room-assignment-rules`)
      if (!response.ok) throw new Error("Failed to fetch rules")
      
      const data: RulesResponse = await response.json()
      setRules(data.rules || [])
      setError(null)
    } catch (err) {
      console.error("Failed to fetch room assignment rules:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  /**
   * Apply rules to determine room for a session.
   * Returns room_id or undefined if no rule matches.
   */
  const getRoomFromRules = useCallback((
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ): string | undefined => {
    // Rules are already sorted by priority (descending)
    for (const rule of rules) {
      let matches = false
      
      switch (rule.rule_type) {
        case "session_key_contains":
          matches = sessionKey.includes(rule.rule_value)
          break
        case "keyword":
          // Check in label
          if (sessionData?.label) {
            matches = sessionData.label.toLowerCase().includes(rule.rule_value.toLowerCase())
          }
          break
        case "model":
          if (sessionData?.model) {
            matches = sessionData.model.toLowerCase().includes(rule.rule_value.toLowerCase())
          }
          break
        case "label_pattern":
          // Regex pattern match
          try {
            const regex = new RegExp(rule.rule_value, "i")
            matches = regex.test(sessionData?.label || "") || regex.test(sessionKey)
          } catch {
            // Invalid regex, skip
          }
          break
        case "session_type":
          // Match session type based on key patterns
          if (rule.rule_value === "cron") matches = sessionKey.includes(":cron:")
          else if (rule.rule_value === "subagent") matches = sessionKey.includes(":subagent:") || sessionKey.includes(":spawn:")
          else if (rule.rule_value === "main") matches = sessionKey === "agent:main:main"
          else if (rule.rule_value === "slack") matches = sessionKey.includes("slack")
          else if (rule.rule_value === "whatsapp") matches = sessionKey.includes("whatsapp") || sessionData?.channel === "whatsapp"
          else if (rule.rule_value === "telegram") matches = sessionKey.includes("telegram") || sessionData?.channel === "telegram"
          else if (rule.rule_value === "discord") matches = sessionKey.includes("discord") || sessionData?.channel === "discord"
          break
      }
      
      if (matches) {
        return rule.room_id
      }
    }
    
    return undefined
  }, [rules])

  const createRule = useCallback(async (rule: Omit<RoomAssignmentRule, "id" | "created_at">) => {
    try {
      const response = await fetch(`${API_BASE}/room-assignment-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule)
      })
      if (!response.ok) throw new Error("Failed to create rule")
      await fetchRules()
      return true
    } catch {
      return false
    }
  }, [fetchRules])

  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const response = await fetch(`${API_BASE}/room-assignment-rules/${ruleId}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete rule")
      await fetchRules()
      return true
    } catch {
      return false
    }
  }, [fetchRules])

  return { 
    rules, 
    isLoading, 
    error, 
    refresh: fetchRules, 
    getRoomFromRules,
    createRule,
    deleteRule
  }
}
