/**
 * RoomInfoTab — Room Stats + Agents in Room list.
 * Extracted from RoomInfoPanel for the tab-based layout.
 */
import type { CrewSession } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { formatSessionKeyAsName } from '@/lib/friendlyNames'

type BotStatus = 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline' | 'meeting'

interface RoomInfoTabProps {
  readonly sessions: CrewSession[]
  readonly isActivelyRunning: (key: string) => boolean
  readonly displayNames: Map<string, string | null>
  readonly onBotClick?: (session: CrewSession) => void
}

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

function getStatusBadge(status: BotStatus): { label: string; color: string; dot: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', dot: '#22c55e' }
    case 'idle':
      return { label: 'Idle', color: '#a16207', dot: '#eab308' }
    case 'supervising':
      return { label: 'Supervising', color: '#7c3aed', dot: '#a78bfa' }
    case 'sleeping':
      return { label: 'Sleeping', color: '#6b7280', dot: '#9ca3af' }
    case 'meeting':
      return { label: 'In Meeting', color: '#0369a1', dot: '#0ea5e9' }
    case 'offline':
      return { label: 'Offline', color: '#991b1b', dot: '#ef4444' }
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
  if (session.label) return session.label
  if (session.displayName && !session.displayName.includes(':')) return session.displayName
  return formatSessionKeyAsName(session.key, session.label)
}

export function RoomInfoTab({
  sessions,
  isActivelyRunning,
  displayNames,
  onBotClick,
}: Readonly<RoomInfoTabProps>) {
  const botData = sessions
    .map((s) => {
      const isActive = isActivelyRunning(s.key)
      const status = getAccurateBotStatus(s, isActive)
      const name = getDisplayName(s, displayNames.get(s.key))
      return { session: s, status, name }
    })
    .sort((a, b) => {
      const order: Record<BotStatus, number> = {
        active: 0,
        meeting: 1,
        supervising: 2,
        idle: 3,
        sleeping: 4,
        offline: 5,
      }
      return order[a.status] - order[b.status]
    })

  const statuses = botData.map((b) => b.status)
  const activeCount = statuses.filter((s) => s === 'active').length
  const idleCount = statuses.filter((s) => s === 'idle').length
  const sleepingCount = statuses.filter((s) => s === 'sleeping' || s === 'offline').length

  return (
    <div
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflow: 'auto',
        flex: 1,
      }}
    >
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
          <div
            style={{
              marginTop: 8,
              padding: '12px 14px',
              background: 'rgba(0,0,0,0.03)',
              borderRadius: 10,
              fontSize: 13,
              color: '#9ca3af',
              textAlign: 'center',
            }}
          >
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
                    background: 'rgba(0,0,0,0.02)',
                    cursor: onBotClick ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.02)'
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: badge.dot,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: badge.color }}>
                    {badge.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#9ca3af',
                      minWidth: 45,
                      textAlign: 'right',
                    }}
                  >
                    {formatModel(session.model)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Shared helpers
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#6b7280',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{children}</span>
    </div>
  )
}
