import { useState } from 'react'
import { useStandups, type StandupDetail } from '@/hooks/useStandups'

interface StandupHistoryProps {
  readonly maxDays?: number
}

export function StandupHistory({ maxDays = 3 }: StandupHistoryProps) {
  const { standups, loading, getStandup } = useStandups(maxDays)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<StandupDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const toggleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(id)
    setDetailLoading(true)
    try {
      const d = await getStandup(id)
      setDetail(d)
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: '#9ca3af', padding: 12 }}>Loading standups…</div>
  }

  if (standups.length === 0) {
    return (
      <div
        style={{
          padding: '16px 14px',
          background: 'rgba(79,70,229,0.04)',
          borderRadius: 10,
          fontSize: 13,
          color: '#9ca3af',
          textAlign: 'center',
        }}
      >
        No recent standups
      </div>
    )
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {standups.map((s) => (
        <div key={s.id}>
          <button
            onClick={() => toggleExpand(s.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${expanded === s.id ? 'rgba(79,70,229,0.2)' : 'rgba(0,0,0,0.06)'}`,
              background: expanded === s.id ? 'rgba(79,70,229,0.04)' : 'rgba(0,0,0,0.02)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>🗓️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {formatDate(s.created_at)} at {formatTime(s.created_at)} · {s.entry_count} entries
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                color: '#9ca3af',
                transform: expanded === s.id ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            >
              ▶
            </span>
          </button>

          {/* Expanded Detail */}
          {expanded === s.id && (
            <div style={{ padding: '8px 0 0 12px' }}>
              {detailLoading ? (
                <div style={{ fontSize: 12, color: '#9ca3af', padding: 8 }}>Loading…</div>
              ) : (
                detail?.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 6,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.06)',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: entry.agent_color || '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        {entry.agent_icon || '🤖'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        {entry.agent_name || entry.agent_key}
                      </span>
                    </div>
                    {entry.yesterday && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        <strong>Yesterday:</strong> {entry.yesterday}
                      </div>
                    )}
                    {entry.today && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        <strong>Today:</strong> {entry.today}
                      </div>
                    )}
                    {entry.blockers && (
                      <div style={{ fontSize: 12, color: '#ef4444' }}>
                        <strong>🚧 Blockers:</strong> {entry.blockers}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
