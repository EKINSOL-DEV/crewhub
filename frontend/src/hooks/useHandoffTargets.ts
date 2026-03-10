import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchHandoffTargets, type HandoffTarget } from '../lib/handoff'

/**
 * Hook to fetch and cache available handoff targets.
 * Fetches once on mount and caches the result.
 */
export function useHandoffTargets() {
  const [targets, setTargets] = useState<HandoffTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetched = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchHandoffTargets()
      setTargets(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch targets')
      // Provide clipboard as fallback
      setTargets([{ id: 'clipboard', label: 'Copy Command', icon: 'clipboard', available: true }])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true
      refresh()
    }
  }, [refresh])

  return { targets, loading, error, refresh }
}
