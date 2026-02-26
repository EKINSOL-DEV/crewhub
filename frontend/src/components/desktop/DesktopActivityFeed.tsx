/**
 * Desktop Activity Feed Panel
 *
 * A collapsible right-side drawer that shows real-time activity from all
 * active agent sessions. Uses the same activityService as MobileActivityPanel
 * and ZenActivityPanel.
 *
 * Features:
 * - Real-time feed via SSE (subscribeToActivityUpdates)
 * - Filter per agent (dropdown)
 * - Time grouping: Just Now / Last Hour / Today / Yesterday / Older
 * - Clickable entries → opens session chat window
 * - Toggle button in the toolbar (⚡ icon)
 * - Open/closed state persisted in localStorage
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { X, RefreshCw, ChevronDown, Zap } from 'lucide-react'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useAgentsRegistry } from '@/hooks/useAgentsRegistry'
import {
  fetchActivityEntries,
  subscribeToActivityUpdates,
  type ActivityEvent,
} from '@/services/activityService'
import { useChatContext } from '@/contexts/ChatContext'

const BORDER_1PX_SOLID_HSL_VAR_BORDER = '1px solid hsl(var(--border))'
const HSL_MUTED_FOREGROUND = 'hsl(var(--muted-foreground))'
const RGBA_255_255_255_0_05 = 'rgba(255,255,255,0.05)'
const TRANSPARENT = 'transparent'

// ── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-desktop-activity-feed-open'
const PANEL_WIDTH = 340

// ── Time Grouping ─────────────────────────────────────────────

function getTimeGroup(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60_000
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

const GROUP_ORDER = ['Just Now', 'Last Hour', 'Today', 'Yesterday', 'This Week', 'Older']

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Agent Dropdown ────────────────────────────────────────────

interface AgentOption {
  id: string
  name: string
}

interface AgentDropdownProps {
  readonly agents: AgentOption[]
  readonly selectedId: string | null
  readonly onChange: (id: string | null) => void
}

function AgentDropdown({ agents, selectedId, onChange }: AgentDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedName = selectedId
    ? (agents.find((a) => a.id === selectedId)?.name ?? 'Agent')
    : 'All Agents'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: selectedId ? 'rgba(139, 92, 246, 0.15)' : RGBA_255_255_255_0_05,
          border: `1px solid ${selectedId ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6,
          color: selectedId ? '#c4b5fd' : '#94a3b8',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedName}
        </span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 10,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: 180,
            maxHeight: 260,
            overflowY: 'auto',
            padding: '4px',
          }}
        >
          {[
            { id: null, name: 'All Agents' },
            ...agents.map((a) => ({ id: a.id, name: a.name })),
          ].map((opt) => (
            <button
              key={opt.id ?? '__all__'}
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: selectedId === opt.id ? 'rgba(139, 92, 246, 0.2)' : TRANSPARENT,
                border: 'none',
                borderRadius: 6,
                color: selectedId === opt.id ? '#c4b5fd' : '#cbd5e1',
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (selectedId !== opt.id)
                  (e.target as HTMLElement).style.background = RGBA_255_255_255_0_05
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLElement).style.background =
                  selectedId === opt.id ? 'rgba(139, 92, 246, 0.2)' : TRANSPARENT
              }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity Entry Item ───────────────────────────────────────

interface EntryItemProps {
  readonly event: ActivityEvent
  readonly onOpen: () => void
}

function EntryItem({ event, onOpen }: EntryItemProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
        padding: '8px 10px',
        background: hovered ? RGBA_255_255_255_0_05 : 'rgba(255,255,255,0.02)',
        border: '1px solid transparent',
        borderColor: hovered ? 'rgba(139,92,246,0.3)' : TRANSPARENT,
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{event.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: event.color || '#cbd5e1',
            wordBreak: 'break-word',
          }}
        >
          {event.description}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {event.sessionName && (
            <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>
              {event.sessionName}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#334155' }}>{formatTime(event.timestamp)}</span>
        </div>
      </div>
    </button>
  )
}

// ── Group Section ─────────────────────────────────────────────

interface GroupSectionProps {
  readonly name: string
  readonly events: ActivityEvent[]
  readonly onOpen: (event: ActivityEvent) => void
}

function GroupSection({ name, events, onOpen }: GroupSectionProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          padding: '0 10px',
          marginBottom: 6,
          marginTop: 4,
        }}
      >
        {name}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {events.map((ev) => (
          <EntryItem key={ev.id} event={ev} onOpen={() => onOpen(ev)} />
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────

interface DesktopActivityFeedProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export function DesktopActivityFeed({ isOpen, onClose }: DesktopActivityFeedProps) {
  const { sessions } = useSessionsStream(true)
  const { agents } = useAgentsRegistry(sessions)
  const { openChat } = useChatContext()

  const [allEvents, setAllEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Fetch activity from all recent sessions
  const fetchAll = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true)

      const activeSessions = sessions.filter((s) => Date.now() - s.updatedAt < 3_600_000)
      try {
        const arrays = await Promise.all(
          activeSessions.map((s) => fetchActivityEntries(s.key, { limit: 20 }))
        )
        const flat = arrays.flat()
        flat.sort((a, b) => b.timestamp - a.timestamp)

        // Annotate with session name
        flat.forEach((ev) => {
          const sess = sessions.find((s) => s.key === ev.sessionKey)
          if (sess) {
            ev.sessionName = sess.label || sess.displayName || sess.key.split(':').pop()
          }
        })

        setAllEvents(flat)
      } catch (err) {
        console.error('[DesktopActivityFeed] fetch error:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sessions]
  )

  // Initial fetch when panel opens
  useEffect(() => {
    if (isOpen) fetchAll()
  }, [isOpen, fetchAll])

  // SSE subscription
  useEffect(() => {
    if (!isOpen) return
    const activeSessions = sessions.filter((s) => Date.now() - s.updatedAt < 3_600_000)
    const unsubscribers = activeSessions.map((s) =>
      subscribeToActivityUpdates(s.key, () => fetchAll(false))
    )
    return () => unsubscribers.forEach((fn) => fn())
  }, [isOpen, sessions, fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll(false)
  }, [fetchAll])

  // Filter
  const filteredEvents = useMemo(() => {
    if (!selectedAgentId) return allEvents
    const prefix = `agent:${selectedAgentId}:`
    return allEvents.filter((ev) => ev.sessionKey.startsWith(prefix))
  }, [allEvents, selectedAgentId])

  // Group
  const groupedEvents = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>()
    for (const ev of filteredEvents) {
      const g = getTimeGroup(ev.timestamp)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(ev)
    }
    return map
  }, [filteredEvents])

  // Open session on entry click
  const handleOpenEvent = useCallback(
    (event: ActivityEvent) => {
      const sess = sessions.find((s) => s.key === event.sessionKey)
      if (!sess) return
      const name = sess.displayName || sess.label || sess.key.split(':').pop() || 'Agent'
      openChat(sess.key, name, undefined, undefined)
    },
    [sessions, openChat]
  )

  const agentOptions: AgentOption[] = useMemo(
    () => agents.map((r) => ({ id: r.agent.id, name: r.agent.name })),
    [agents]
  )

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: isOpen ? PANEL_WIDTH : 0,
        zIndex: 50,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          background: 'hsl(var(--card))',
          borderLeft: BORDER_1PX_SOLID_HSL_VAR_BORDER,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : `translateX(${PANEL_WIDTH}px)`,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 12px 10px',
            borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
            flexShrink: 0,
          }}
        >
          <Zap size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>
            Activity Feed
          </span>

          <AgentDropdown
            agents={agentOptions}
            selectedId={selectedAgentId}
            onChange={setSelectedAgentId}
          />

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: TRANSPARENT,
              border: 'none',
              borderRadius: 6,
              cursor: refreshing ? 'wait' : 'pointer',
              color: HSL_MUTED_FOREGROUND,
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: refreshing ? 'daf-spin 1s linear infinite' : 'none' }}
            />
          </button>

          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: TRANSPARENT,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: HSL_MUTED_FOREGROUND,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Event count */}
        <div
          style={{
            fontSize: 11,
            color: HSL_MUTED_FOREGROUND,
            padding: '6px 12px',
            borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
            flexShrink: 0,
          }}
        >
          {loading
            ? 'Loading…'
            : `${filteredEvents.length} event${filteredEvents.length === 1 ? '' : 's'}`}
          {selectedAgentId && ' (filtered)'}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {loading && !allEvents.length && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: HSL_MUTED_FOREGROUND,
                fontSize: 13,
                gap: 12,
                paddingTop: 40,
              }}
            >
              <RefreshCw size={20} style={{ animation: 'daf-spin 1s linear infinite' }} />
              Loading activity…
            </div>
          )}

          {!loading && filteredEvents.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: HSL_MUTED_FOREGROUND,
                fontSize: 13,
                gap: 8,
                paddingTop: 40,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 32 }}>💤</span>
              <span>{selectedAgentId ? 'No activity for this agent' : 'No recent activity'}</span>
            </div>
          )}

          {GROUP_ORDER.map((groupName) => {
            const events = groupedEvents.get(groupName)
            if (!events || events.length === 0) return null
            return (
              <GroupSection
                key={groupName}
                name={groupName}
                events={events}
                onOpen={handleOpenEvent}
              />
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes daf-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ── Toggle Button ─────────────────────────────────────────────

interface DesktopActivityFeedButtonProps {
  readonly isOpen: boolean
  readonly onClick: () => void
  readonly eventCount?: number
}

export function DesktopActivityFeedButton({
  isOpen,
  onClick,
  eventCount,
}: DesktopActivityFeedButtonProps) {
  return (
    <button
      onClick={onClick}
      title={isOpen ? 'Hide Activity Feed' : 'Show Activity Feed'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        background: isOpen ? 'rgba(139,92,246,0.15)' : TRANSPARENT,
        border: `1px solid ${isOpen ? '#8b5cf6' : TRANSPARENT}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: isOpen ? '#a78bfa' : HSL_MUTED_FOREGROUND,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
    >
      <Zap size={16} />
      {typeof eventCount === 'number' && eventCount > 0 && !isOpen && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#a78bfa',
          }}
        />
      )}
    </button>
  )
}

// ── Hook: Manage Open State with localStorage ─────────────────

export function useDesktopActivityFeed() {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'false')
    } catch {
      /* ignore */
    }
  }, [])

  return { isOpen, toggle, close }
}
