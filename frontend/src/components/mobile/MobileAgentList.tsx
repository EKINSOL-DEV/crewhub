import { RefreshCw, Wifi, WifiOff, Users, Menu } from 'lucide-react'
import type { AgentRuntime, AgentStatus } from '@/hooks/useAgentsRegistry'
import type { Thread } from '@/lib/threads.api'
import { ParticipantAvatarStack } from './group/ParticipantAvatarStack'

interface MobileAgentListProps {
  readonly agents: AgentRuntime[]
  readonly loading: boolean
  readonly connected: boolean
  readonly onSelectAgent: (
    agentId: string,
    name: string,
    icon: string | null,
    color: string | null,
    sessionKey: string
  ) => void
  readonly onRefresh: () => void
  readonly threads?: Thread[]
  readonly onNewGroup?: () => void
  readonly onSelectThread?: (thread: Thread) => void
  readonly onOpenDrawer?: () => void
}

// Deterministic color from agent id
const AGENT_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#10b981',
  '#6366f1',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#3b82f6',
]

function getAgentColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = Math.trunc(hash * 31 + (key.codePointAt(i) ?? 0))
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

function getStatusInfo(status: AgentStatus): { label: string; dot: string } {
  switch (status) {
    case 'thinking':
      return { label: 'Thinking…', dot: '#fbbf24' }
    case 'working':
      return { label: 'Working', dot: '#22c55e' }
    case 'supervising':
      return { label: 'Supervising', dot: '#8b5cf6' }
    case 'idle':
      return { label: 'Idle', dot: '#64748b' }
    case 'offline':
      return { label: 'Offline', dot: '#334155' }
  }
}

function getTimeSince(updatedAt: number): string {
  if (!updatedAt) return ''
  const diff = Date.now() - updatedAt
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function MobileAgentList({
  agents,
  loading,
  connected,
  onSelectAgent,
  onRefresh,
  threads = [],
  onNewGroup,
  onSelectThread,
  onOpenDrawer,
}: MobileAgentListProps) {
  const onlineCount = agents.filter((a) => a.status !== 'offline').length

  return (
    <>
      {/* Header */}
      <header
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--mobile-border, rgba(255,255,255,0.06))',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onOpenDrawer && (
            <button
              onClick={onOpenDrawer}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: 'var(--mobile-surface2, rgba(255,255,255,0.06))',
                color: 'var(--mobile-text-muted, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Menu size={18} />
            </button>
          )}
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: 'var(--mobile-text, #f1f5f9)',
              }}
            >
              CrewHub
            </h1>
            <div
              style={{
                fontSize: 12,
                color: 'var(--mobile-text-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              {connected ? (
                <>
                  <Wifi size={12} color="#22c55e" />{' '}
                  <span>
                    {onlineCount} of {agents.length} agents online
                  </span>
                </>
              ) : (
                <>
                  <WifiOff size={12} color="#ef4444" /> <span>Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onNewGroup && (
            <button
              onClick={onNewGroup}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: 'rgba(99,102,241,0.15)',
                color: '#818cf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="New group chat"
            >
              <Users size={16} />
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'var(--mobile-surface2, rgba(255,255,255,0.06))',
              color: 'var(--mobile-text-muted, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Agent List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '8px 12px',
        }}
      >
        {agents.map((runtime) => {
          const { agent, session, status, childSessions } = runtime
          const name = agent.name || agent.id
          const color = agent.color || getAgentColor(agent.id)
          const icon = agent.icon || name.charAt(0).toUpperCase()
          const statusInfo = getStatusInfo(status)
          const timeSince = session ? getTimeSince(session.updatedAt) : ''
          const sessionKey = session?.key || agent.agent_session_key || `agent:${agent.id}:main`
          const activeSubagents = childSessions.length

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id, name, agent.icon, color, sessionKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '14px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'inherit',
                transition: 'background 0.15s',
                opacity: status === 'offline' ? 0.5 : 1,
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    background: color + '25',
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 600,
                  }}
                >
                  {icon}
                </div>
                {/* Status dot */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: statusInfo.dot,
                    border: '2.5px solid var(--mobile-bg, #0f172a)',
                  }}
                />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--mobile-text, #f1f5f9)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--mobile-text-muted, #64748b)',
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{statusInfo.label}</span>
                  {activeSubagents > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 6,
                        background: 'rgba(139, 92, 246, 0.15)',
                        color: '#a78bfa',
                      }}
                    >
                      {activeSubagents} task{activeSubagents === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>

              {/* Time */}
              {timeSince && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--mobile-text-muted, #475569)',
                    flexShrink: 0,
                  }}
                >
                  {timeSince}
                </div>
              )}
            </button>
          )
        })}

        {/* Group Threads Section */}
        {threads.length > 0 && (
          <>
            <div
              style={{
                padding: '16px 12px 8px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--mobile-text-muted, #64748b)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Group Chats
            </div>
            {threads.map((thread) => {
              const title = thread.title || thread.title_auto || 'Group Chat'
              const activeParticipants = thread.participants.filter((p) => p.is_active)
              const timeSince = thread.last_message_at
                ? getTimeSince(thread.last_message_at)
                : getTimeSince(thread.created_at)

              return (
                <button
                  key={thread.id}
                  onClick={() => onSelectThread?.(thread)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    width: '100%',
                    padding: '14px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Avatar stack */}
                  <div style={{ flexShrink: 0 }}>
                    <ParticipantAvatarStack
                      participants={activeParticipants}
                      size={44}
                      maxShow={3}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--mobile-text, #f1f5f9)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--mobile-text-muted, #64748b)',
                        marginTop: 2,
                      }}
                    >
                      {activeParticipants.length} agents
                    </div>
                  </div>

                  {/* Time */}
                  {timeSince && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--mobile-text-muted, #475569)',
                        flexShrink: 0,
                      }}
                    >
                      {timeSince}
                    </div>
                  )}
                </button>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
