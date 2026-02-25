import { useEffect, useRef, useState, useCallback } from 'react'
import {
  fetchActivityEntries,
  subscribeToActivityUpdates,
  type ActivityEvent,
} from '@/services/activityService'

interface ActivityLogStreamProps {
  sessionKey: string
  onOpenFullLog?: () => void
}

// ── Helper: Format Time ──────────────────────────────────────

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ──────────────────────────────────────────────────

export function ActivityLogStream({ sessionKey, onOpenFullLog }: ActivityLogStreamProps) {
  const [entries, setEntries] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const activityEvents = await fetchActivityEntries(sessionKey, { limit: 20 })
      setEntries(activityEvents)
    } catch (error) {
      console.error('[ActivityLogStream] Failed to fetch activity:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionKey])

  // Initial fetch
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Subscribe to SSE for live updates
  useEffect(() => {
    return subscribeToActivityUpdates(sessionKey, fetchHistory)
  }, [sessionKey, fetchHistory])

  // Auto-scroll on new entries
  useEffect(() => {
    if (entries.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevCountRef.current = entries.length
  }, [entries])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
          fontSize: 13,
        }}
      >
        Loading activity…
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 32 }}>💤</span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>No recent activity</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {entries.map((entry, i) => {
          // Show time header if different from previous
          const prevTime = i > 0 ? formatTime(entries[i - 1].timestamp) : ''
          const thisTime = formatTime(entry.timestamp)
          const showTime = thisTime && thisTime !== prevTime

          return (
            <div key={entry.id}>
              {showTime && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#9ca3af',
                    textAlign: 'center',
                    padding: '4px 0 2px',
                    fontWeight: 500,
                  }}
                >
                  {thisTime}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 4px',
                  animation: i === entries.length - 1 ? 'activityFadeIn 0.3s ease-out' : undefined,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                <div
                  style={{
                    flex: 1,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: entry.color || '#374151',
                    background: 'rgba(0, 0, 0, 0.03)',
                    padding: '6px 10px',
                    borderRadius: 10,
                    wordBreak: 'break-word',
                  }}
                >
                  {entry.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View Full Log link */}
      {onOpenFullLog && (
        <button
          onClick={onOpenFullLog}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: 12,
            fontWeight: 500,
            color: '#6b7280',
            background: 'none',
            border: 'none',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#374151'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6b7280'
          }}
        >
          View Full Log →
        </button>
      )}

      <style>{`
        @keyframes activityFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
