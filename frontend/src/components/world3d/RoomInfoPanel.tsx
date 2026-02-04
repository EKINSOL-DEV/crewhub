import { useEffect, useRef, useMemo } from 'react'
import type { CrewSession } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import type { Room } from '@/hooks/useRooms'

// ── Types ──────────────────────────────────────────────────────

type BotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

interface RoomInfoPanelProps {
  room: Room
  sessions: CrewSession[]
  isActivelyRunning: (key: string) => boolean
  displayNames: Map<string, string | null>
  onClose: () => void
  onBotClick?: (session: CrewSession) => void
}

// ── Helpers ────────────────────────────────────────────────────

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

function getStatusBadge(status: BotStatus): { label: string; color: string; bg: string; dot: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', bg: '#dcfce7', dot: '#22c55e' }
    case 'idle':
      return { label: 'Idle', color: '#a16207', bg: '#fef9c3', dot: '#eab308' }
    case 'sleeping':
      return { label: 'Sleeping', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' }
    case 'offline':
      return { label: 'Offline', color: '#991b1b', bg: '#fecaca', dot: '#ef4444' }
  }
}

function formatModel(model?: string): string {
  if (!model) return '—'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gpt-5')) return 'GPT-5'
  const parts = model.split('/')
  return parts[parts.length - 1].slice(0, 16)
}

function getDisplayName(session: CrewSession, aliasName: string | null | undefined): string {
  if (aliasName) return aliasName
  if (session.displayName) return session.displayName
  // Extract agent name from key like "agent:gamedev:main" → "Gamedev"
  const parts = session.key.split(':')
  if (parts.length >= 2) {
    const name = parts[1]
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return session.key
}

function getRoomActivityStatus(statuses: BotStatus[]): { label: string; color: string } {
  const activeCount = statuses.filter(s => s === 'active').length
  if (activeCount > 0) return { label: `${activeCount} agent${activeCount > 1 ? 's' : ''} working`, color: '#15803d' }
  const idleCount = statuses.filter(s => s === 'idle').length
  if (idleCount > 0) return { label: 'Idle', color: '#a16207' }
  if (statuses.length > 0) return { label: 'All sleeping', color: '#6b7280' }
  return { label: 'Empty', color: '#9ca3af' }
}

// ── Component ──────────────────────────────────────────────────

export function RoomInfoPanel({
  room,
  sessions,
  isActivelyRunning,
  displayNames,
  onClose,
  onBotClick,
}: RoomInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const roomColor = room.color || '#4f46e5'

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setTimeout(() => onClose(), 50)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 200)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Compute bot statuses
  const botData = useMemo(() => {
    return sessions.map(s => {
      const isActive = isActivelyRunning(s.key)
      const status = getAccurateBotStatus(s, isActive)
      const name = getDisplayName(s, displayNames.get(s.key))
      return { session: s, status, name }
    }).sort((a, b) => {
      // Sort: active first, then idle, sleeping, offline
      const order: Record<BotStatus, number> = { active: 0, idle: 1, sleeping: 2, offline: 3 }
      return order[a.status] - order[b.status]
    })
  }, [sessions, isActivelyRunning, displayNames])

  const statuses = botData.map(b => b.status)
  const activeCount = statuses.filter(s => s === 'active').length
  const idleCount = statuses.filter(s => s === 'idle').length
  const sleepingCount = statuses.filter(s => s === 'sleeping' || s === 'offline').length
  const activityStatus = getRoomActivityStatus(statuses)

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 360,
        zIndex: 60,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'roomPanelSlideIn 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        {/* Room icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: roomColor + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
        }}>
          {room.icon || '🏠'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {room.name}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: activityStatus.color,
              background: activityStatus.color + '15',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: activityStatus.color,
                display: 'inline-block',
              }} />
              {activityStatus.label}
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(0, 0, 0, 0.05)',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
        >
          ✕
        </button>
      </div>

      {/* Separator */}
      <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', margin: '16px 0 0' }} />

      {/* Info Body */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Room Stats */}
        <div>
          <SectionHeader>📊 Room Stats</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <InfoRow label="Total Agents">{sessions.length}</InfoRow>
            <InfoRow label="Active">
              <span style={{ color: '#15803d', fontWeight: 600 }}>{activeCount}</span>
            </InfoRow>
            <InfoRow label="Idle">
              <span style={{ color: '#a16207', fontWeight: 600 }}>{idleCount}</span>
            </InfoRow>
            <InfoRow label="Sleeping">
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{sleepingCount}</span>
            </InfoRow>
          </div>
        </div>

        {/* Agent List */}
        <div>
          <SectionHeader>🤖 Agents in Room</SectionHeader>
          {botData.length === 0 ? (
            <div style={{
              marginTop: 8,
              padding: '12px 14px',
              background: 'rgba(0, 0, 0, 0.03)',
              borderRadius: 10,
              fontSize: 13,
              color: '#9ca3af',
              textAlign: 'center',
            }}>
              No agents in this room
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {botData.map(({ session, status, name }) => {
                const badge = getStatusBadge(status)
                return (
                  <button
                    key={session.key}
                    onClick={() => onBotClick?.(session)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(0, 0, 0, 0.02)',
                      cursor: onBotClick ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)' }}
                  >
                    {/* Status dot */}
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: badge.dot,
                      flexShrink: 0,
                    }} />

                    {/* Name */}
                    <span style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>

                    {/* Status label */}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: badge.color,
                    }}>
                      {badge.label}
                    </span>

                    {/* Model */}
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#9ca3af',
                      minWidth: 45,
                      textAlign: 'right',
                    }}>
                      {formatModel(session.model)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Project Section — Placeholder for Phase 3 */}
        <div>
          <SectionHeader>📋 Project</SectionHeader>
          <div style={{
            marginTop: 8,
            padding: '12px 14px',
            background: 'rgba(0, 0, 0, 0.03)',
            borderRadius: 10,
            fontSize: 13,
            color: '#9ca3af',
            textAlign: 'center',
          }}>
            General Room
          </div>
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes roomPanelSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Reusable components ────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        color: '#374151',
        fontWeight: 600,
      }}>
        {children}
      </span>
    </div>
  )
}
