import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'

export interface RoomAssignmentRule {
  id: string
  room_id: string
  rule_type: 'keyword' | 'model' | 'label_pattern' | 'session_type' | 'session_key_contains'
  rule_value: string
  priority: number
  created_at: number
}

interface RulesResponse {
  rules: RoomAssignmentRule[]
}

// ── Rule Matching ─────────────────────────────────────────────

function matchesSessionType(ruleValue: string, sessionKey: string, channel?: string): boolean {
  if (ruleValue === 'cron') return sessionKey.includes(':cron:')
  if (ruleValue === 'subagent')
    return sessionKey.includes(':subagent:') || sessionKey.includes(':spawn:')
  if (ruleValue === 'main') return sessionKey === 'agent:main:main'
  if (ruleValue === 'slack') return sessionKey.includes('slack')
  if (ruleValue === 'whatsapp') return sessionKey.includes('whatsapp') || channel === 'whatsapp'
  if (ruleValue === 'telegram') return sessionKey.includes('telegram') || channel === 'telegram'
  if (ruleValue === 'discord') return sessionKey.includes('discord') || channel === 'discord'
  return false
}

function matchesRule(
  rule: RoomAssignmentRule,
  sessionKey: string,
  sessionData?: { label?: string; model?: string; channel?: string }
): boolean {
  switch (rule.rule_type) {
    case 'session_key_contains':
      return sessionKey.includes(rule.rule_value)
    case 'keyword':
      return !!sessionData?.label?.toLowerCase().includes(rule.rule_value.toLowerCase())
    case 'model':
      return !!sessionData?.model?.toLowerCase().includes(rule.rule_value.toLowerCase())
    case 'label_pattern':
      try {
        const regex = new RegExp(rule.rule_value, 'i')
        return regex.test(sessionData?.label || '') || regex.test(sessionKey)
      } catch {
        return false
      }
    case 'session_type':
      return matchesSessionType(rule.rule_value, sessionKey, sessionData?.channel)
    default:
      return false
  }
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
      if (!response.ok) throw new Error('Failed to fetch rules')

      const data: RulesResponse = await response.json()
      setRules(data.rules || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch room assignment rules:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
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
  const getRoomFromRules = useCallback(
    (
      sessionKey: string,
      sessionData?: { label?: string; model?: string; channel?: string }
    ): string | undefined => {
      // Rules are already sorted by priority (descending)
      for (const rule of rules) {
        if (matchesRule(rule, sessionKey, sessionData)) return rule.room_id
      }
      return undefined
    },
    [rules]
  )

  const createRule = useCallback(
    async (rule: Omit<RoomAssignmentRule, 'id' | 'created_at'>) => {
      try {
        const response = await fetch(`${API_BASE}/room-assignment-rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rule),
        })
        if (!response.ok) throw new Error('Failed to create rule')
        await fetchRules()
        return true
      } catch {
        return false
      }
    },
    [fetchRules]
  )

  const deleteRule = useCallback(
    async (ruleId: string) => {
      try {
        const response = await fetch(`${API_BASE}/room-assignment-rules/${ruleId}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete rule')
        await fetchRules()
        return true
      } catch {
        return false
      }
    },
    [fetchRules]
  )

  const updateRule = useCallback(
    async (ruleId: string, updates: Partial<Omit<RoomAssignmentRule, 'id' | 'created_at'>>) => {
      try {
        const response = await fetch(`${API_BASE}/room-assignment-rules/${ruleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!response.ok) throw new Error('Failed to update rule')
        await fetchRules()
        return true
      } catch {
        return false
      }
    },
    [fetchRules]
  )

  const reorderRules = useCallback(
    async (ruleIds: string[]) => {
      // Update priorities based on position (higher index = lower priority)
      try {
        const maxPriority = ruleIds.length * 10
        await Promise.all(
          ruleIds.map((ruleId, index) => updateRule(ruleId, { priority: maxPriority - index * 10 }))
        )
        return true
      } catch {
        return false
      }
    },
    [updateRule]
  )

  return {
    rules,
    isLoading,
    error,
    refresh: fetchRules,
    getRoomFromRules,
    createRule,
    deleteRule,
    updateRule,
    reorderRules,
  }
}
