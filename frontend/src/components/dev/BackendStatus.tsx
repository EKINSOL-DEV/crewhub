import { useState, useEffect } from 'react'

/**
 * Dev-mode only indicator showing backend URL and uptime.
 * Polls /health every 60s.
 */
export function BackendStatus() {
  const [uptime, setUptime] = useState<string | null>(null)
  const [reachable, setReachable] = useState(true)

  void (import.meta.env.VITE_API_URL || window.location.origin) // backendUrl removed from display per UX feedback

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          setUptime(data.uptime_human ?? null)
          setReachable(true)
        } else {
          setReachable(false)
        }
      } catch {
        setReachable(false)
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!import.meta.env.DEV) return null

  return (
    <span
      style={{ fontSize: '10px', marginLeft: 8 }}
      className={reachable ? 'text-muted-foreground' : 'text-red-500'}
    >
      {uptime ? `uptime: ${uptime}` : reachable ? '' : 'backend unreachable'}
    </span>
  )
}
