import { useState, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/api"

// ── Types ──────────────────────────────────────────────────────

export interface Standup {
  id: string
  title: string
  created_by: string
  created_at: number
  entry_count: number
}

export interface StandupEntry {
  id: string
  standup_id: string
  agent_key: string
  yesterday: string
  today: string
  blockers: string
  submitted_at: number
  agent_name: string | null
  agent_icon: string | null
  agent_color: string | null
}

export interface StandupDetail extends Standup {
  entries: StandupEntry[]
}

// ── Hook ───────────────────────────────────────────────────────

export function useStandups(days = 7) {
  const [standups, setStandups] = useState<Standup[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/standups?days=${days}`)
      if (res.ok) {
        const data = await res.json()
        setStandups(data.standups)
      }
    } catch (e) {
      console.error("Failed to fetch standups:", e)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { refresh() }, [refresh])

  const createStandup = useCallback(async (title: string, participants: string[]) => {
    const res = await fetch(`${API_BASE}/standups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, participants }),
    })
    if (!res.ok) throw new Error("Failed to create standup")
    const data = await res.json()
    await refresh()
    return data
  }, [refresh])

  const submitEntry = useCallback(async (
    standupId: string,
    agentKey: string,
    yesterday: string,
    today: string,
    blockers: string,
  ) => {
    const res = await fetch(`${API_BASE}/standups/${standupId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_key: agentKey, yesterday, today, blockers }),
    })
    if (!res.ok) throw new Error("Failed to submit entry")
    return await res.json()
  }, [])

  const getStandup = useCallback(async (id: string): Promise<StandupDetail> => {
    const res = await fetch(`${API_BASE}/standups/${id}`)
    if (!res.ok) throw new Error("Standup not found")
    return await res.json()
  }, [])

  return { standups, loading, refresh, createStandup, submitEntry, getStandup }
}
