/**
 * Mobile Activity Panel
 * Real-time activity feed using centralized activityService
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowLeft, Filter, RefreshCw } from 'lucide-react'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useAgentsRegistry } from '@/hooks/useAgentsRegistry'
import { useProjects } from '@/hooks/useProjects'
import {
  fetchActivityEntries,
  subscribeToActivityUpdates,
  type ActivityEvent,
} from '@/services/activityService'

const RGBA_139_92_246_0_2 = 'rgba(139, 92, 246, 0.2)'
const RGBA_255_255_255_0_03 = 'rgba(255, 255, 255, 0.03)'
const RGBA_255_255_255_0_06 = 'rgba(255, 255, 255, 0.06)'
const TRANSPARENT = 'transparent'

interface MobileActivityPanelProps {
  readonly onBack: () => void
}

// ── Time Grouping Helpers ────────────────────────────────────

function getTimeGroup(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  if (diff < minute) return 'Just Now'
  if (diff < hour) return 'Last Hour'
  if (diff < day) return 'Today'
  if (diff < 2 * day) return 'Yesterday'
  if (diff < week) return 'This Week'
  return 'Older'
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Activity Event Item ──────────────────────────────────────

interface ActivityEventItemProps {
  readonly event: ActivityEvent
  readonly showTime: boolean
}

function ActivityEventItem({ event, showTime }: ActivityEventItemProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {showTime && (
        <div
          style={{
            fontSize: 10,
            color: '#64748b',
            textAlign: 'center',
            padding: '4px 0',
            fontWeight: 600,
          }}
        >
          {formatTime(event.timestamp)}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{event.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: event.color || '#cbd5e1',
              wordBreak: 'break-word',
            }}
          >
            {event.description}
          </div>
          {event.sessionName && (
            <div
              style={{
                fontSize: 10,
                color: '#475569',
                marginTop: 4,
              }}
            >
              {event.sessionName}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Filter Sheet ──────────────────────────────────────────────

interface FilterSheetProps {
  readonly agents: Array<{ id: string; name: string }>
  readonly projects: Array<{ id: string; name: string; color?: string }>
  readonly selectedAgentId: string | null
  readonly selectedProjectId: string | null
  readonly selectedEventType: string | null
  readonly onSelectAgent: (agentId: string | null) => void
  readonly onSelectProject: (projectId: string | null) => void
  readonly onSelectEventType: (type: string | null) => void
  readonly onClose: () => void
}

function FilterSheet({
  agents,
  projects,
  selectedAgentId,
  selectedProjectId,
  selectedEventType,
  onSelectAgent,
  onSelectProject,
  onSelectEventType,
  onClose,
}: FilterSheetProps) {
  const [tab, setTab] = useState<'agent' | 'project' | 'type'>('agent')

  return (
    <button
      type="button"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '70vh',
          background: '#1e293b',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>
          Filter Activity
        </h3>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['agent', 'project', 'type'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: tab === t ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                border: `1px solid ${tab === t ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                borderRadius: 8,
                color: tab === t ? '#c4b5fd' : '#94a3b8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {tab === 'agent' && (
            <>
              <button
                onClick={() => {
                  onSelectAgent(null)
                  onClose()
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background:
                    selectedAgentId === null ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                  border: `1px solid ${selectedAgentId === null ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                  borderRadius: 10,
                  color: selectedAgentId === null ? '#c4b5fd' : '#cbd5e1',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                All Agents
              </button>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onSelectAgent(agent.id)
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background:
                      selectedAgentId === agent.id ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                    border: `1px solid ${selectedAgentId === agent.id ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                    borderRadius: 10,
                    color: selectedAgentId === agent.id ? '#c4b5fd' : '#cbd5e1',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {agent.name}
                </button>
              ))}
            </>
          )}

          {tab === 'project' && (
            <>
              <button
                onClick={() => {
                  onSelectProject(null)
                  onClose()
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background:
                    selectedProjectId === null ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                  border: `1px solid ${selectedProjectId === null ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                  borderRadius: 10,
                  color: selectedProjectId === null ? '#c4b5fd' : '#cbd5e1',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                All Projects
              </button>
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj.id)
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background:
                      selectedProjectId === proj.id ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                    border: `1px solid ${selectedProjectId === proj.id ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                    borderRadius: 10,
                    color: selectedProjectId === proj.id ? '#c4b5fd' : '#cbd5e1',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {proj.color && (
                    <span
                      style={{ width: 12, height: 12, borderRadius: '50%', background: proj.color }}
                    />
                  )}
                  <span>{proj.name}</span>
                </button>
              ))}
            </>
          )}

          {tab === 'type' && (
            <>
              {[
                { value: null, label: 'All Events' },
                { value: 'tool_call', label: 'Tool Calls' },
                { value: 'tool_result', label: 'Tool Results' },
                { value: 'message', label: 'Messages' },
                { value: 'thinking', label: 'Thinking' },
              ].map((t) => (
                <button
                  key={t.value || 'all'}
                  onClick={() => {
                    onSelectEventType(t.value)
                    onClose()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background:
                      selectedEventType === t.value ? RGBA_139_92_246_0_2 : RGBA_255_255_255_0_03,
                    border: `1px solid ${selectedEventType === t.value ? '#8b5cf6' : RGBA_255_255_255_0_06}`,
                    borderRadius: 10,
                    color: selectedEventType === t.value ? '#c4b5fd' : '#cbd5e1',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Main Component ───────────────────────────────────────────

export function MobileActivityPanel({ onBack }: MobileActivityPanelProps) {
  const { sessions } = useSessionsStream(true)
  const { agents } = useAgentsRegistry(sessions)
  const { projects } = useProjects()

  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null)

  // Fetch activity from all active sessions
  const fetchAllActivity = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true)

      const activeSessions = sessions.filter((s) => Date.now() - s.updatedAt < 3600000) // Last hour
      const eventsPromises = activeSessions.map((s) => fetchActivityEntries(s.key, { limit: 20 }))

      try {
        const eventsArrays = await Promise.all(eventsPromises)
        const allEventsFlat = eventsArrays.flat()

        // Sort by timestamp descending
        allEventsFlat.sort((a, b) => b.timestamp - a.timestamp)

        // Add session names from registry
        allEventsFlat.forEach((event) => {
          const session = sessions.find((s) => s.key === event.sessionKey)
          if (session) {
            event.sessionName = session.label || session.key.split(':').pop()
          }
        })

        setAllEvents(allEventsFlat)
      } catch (error) {
        console.error('[MobileActivityPanel] Failed to fetch activity:', error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sessions]
  )

  // Initial fetch
  useEffect(() => {
    fetchAllActivity()
  }, [fetchAllActivity])

  // Subscribe to SSE updates
  useEffect(() => {
    const activeSessions = sessions.filter((s) => Date.now() - s.updatedAt < 3600000)
    const unsubscribers = activeSessions.map((s) =>
      subscribeToActivityUpdates(s.key, () => fetchAllActivity(false))
    )

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [sessions, fetchAllActivity])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAllActivity(false)
  }, [fetchAllActivity])

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = allEvents

    // Filter by agent
    if (selectedAgentId) {
      const agentPrefix = `agent:${selectedAgentId}:`
      filtered = filtered.filter((e) => e.sessionKey.startsWith(agentPrefix))
    }

    // Filter by event type
    if (selectedEventType) {
      filtered = filtered.filter((e) => e.type === selectedEventType)
    }

    // FUTURE: Filter by project (requires project metadata in events)

    return filtered
  }, [allEvents, selectedAgentId, selectedEventType])

  // Group events by time
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>()

    for (const event of filteredEvents) {
      const group = getTimeGroup(event.timestamp)
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(event)
    }

    return groups
  }, [filteredEvents])

  const groupOrder = ['Just Now', 'Last Hour', 'Today', 'Yesterday', 'This Week', 'Older']
  const hasActiveFilters =
    selectedAgentId !== null || selectedProjectId !== null || selectedEventType !== null

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: TRANSPARENT,
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>Activity Feed</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: TRANSPARENT,
            color: '#94a3b8',
            cursor: refreshing ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshCw
            size={18}
            style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
          />
        </button>

        <button
          onClick={() => setShowFilter(true)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: hasActiveFilters ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.1)',
            background: hasActiveFilters ? 'rgba(139, 92, 246, 0.15)' : TRANSPARENT,
            color: hasActiveFilters ? '#a78bfa' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Filter size={18} />
        </button>
      </header>

      {/* Activity List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            Loading activity...
          </div>
        )}

        {!loading && filteredEvents.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💤</div>
            <div style={{ fontSize: 14 }}>
              {hasActiveFilters ? 'No activity matching filters' : 'No recent activity'}
            </div>
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groupOrder.map((groupName) => {
              const groupEvents = groupedEvents.get(groupName)
              if (!groupEvents || groupEvents.length === 0) return null

              return (
                <div key={groupName}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 12,
                    }}
                  >
                    {groupName}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupEvents.map((event, i) => {
                      const prevEvent = i > 0 ? groupEvents[i - 1] : null
                      const showTime =
                        !prevEvent ||
                        formatTime(event.timestamp) !== formatTime(prevEvent.timestamp)
                      return <ActivityEventItem key={event.id} event={event} showTime={showTime} />
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      {showFilter && (
        <FilterSheet
          agents={agents.map((r) => ({ id: r.agent.id, name: r.agent.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color || undefined }))}
          selectedAgentId={selectedAgentId}
          selectedProjectId={selectedProjectId}
          selectedEventType={selectedEventType}
          onSelectAgent={setSelectedAgentId}
          onSelectProject={setSelectedProjectId}
          onSelectEventType={setSelectedEventType}
          onClose={() => setShowFilter(false)}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
