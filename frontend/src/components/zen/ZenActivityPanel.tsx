/**
 * Zen Activity Panel
 * Shows active tasks (running subagents) prominently,
 * with a collapsible SSE event log below.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { sseManager } from '@/lib/sseManager'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useActiveTasks, type ActiveTask } from '@/hooks/useActiveTasks'
import { ZenActivityDetailPanel } from './ZenActivityDetailPanel'
import type { CrewSession } from '@/lib/api'
import { formatEventTime } from '@/lib/formatters'

// ── Activity Event Types (for event log) ──────────────────────

interface ActivityEvent {
  id: string
  type: 'created' | 'updated' | 'removed' | 'status'
  timestamp: number
  sessionKey: string
  sessionName: string
  description: string
  icon: string
  details?: string
}

// ── Helpers ───────────────────────────────────────────────────

function getAgentName(session: Partial<CrewSession>): string {
  return session.displayName || session.label || session.key?.split(':').pop() || 'Agent'
}

function getSessionIcon(session: Partial<CrewSession>): string {
  const kind = session.kind?.toLowerCase() || ''
  const channel = session.channel?.toLowerCase() || ''
  if (kind.includes('dev') || kind.includes('code')) return '💻'
  if (kind.includes('chat')) return '💬'
  if (kind.includes('task')) return '📋'
  if (channel.includes('slack')) return '📢'
  if (channel.includes('discord')) return '🎮'
  if (channel.includes('whatsapp')) return '📱'
  return '🤖'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'var(--zen-success)'
    case 'done':
      return 'var(--zen-fg-dim)'
    default:
      return 'var(--zen-fg-muted)'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '● Running'
    case 'done':
      return '✓ Done'
    default:
      return status
  }
}

// ── Active Task Item ──────────────────────────────────────────

function ActiveTaskItem({
  task,
  opacity,
  isSelected,
  onSelect,
}: Readonly<{
  readonly task: ActiveTask
  readonly opacity: number
  readonly isSelected: boolean
  readonly onSelect: () => void
}>) {
  return (
    <div
      className={`zen-active-task-item zen-fade-in ${isSelected ? 'zen-active-task-item-selected' : ''}`}
      style={{ opacity, cursor: 'pointer' }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="zen-active-task-icon">{task.agentIcon || '🤖'}</div>
      <div className="zen-active-task-content">
        <div className="zen-active-task-title">{task.title}</div>
        <div className="zen-active-task-meta">
          {task.agentName && <span className="zen-active-task-agent">{task.agentName}</span>}
          <span className="zen-active-task-status" style={{ color: getStatusColor(task.status) }}>
            {getStatusLabel(task.status)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Event Log Item ────────────────────────────────────────────

function EventLogItem({ event }: Readonly<{ event: ActivityEvent }>) {
  const typeColors: Record<string, string> = {
    created: 'var(--zen-success)',
    updated: 'var(--zen-info)',
    removed: 'var(--zen-error)',
    status: 'var(--zen-warning)',
  }

  return (
    <div className="zen-activity-item">
      <div className="zen-activity-time">{formatEventTime(event.timestamp)}</div>
      <div
        className="zen-activity-type"
        style={{ color: typeColors[event.type] || 'var(--zen-fg-muted)' }}
      >
        {event.type.toUpperCase().slice(0, 3)}
      </div>
      <div className="zen-activity-icon">{event.icon}</div>
      <div className="zen-activity-content">
        <span className="zen-activity-agent">{event.sessionName}</span>
        <span className="zen-activity-desc">{event.description}</span>
        {event.details && <span className="zen-activity-details">{event.details}</span>}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-activity-empty">
      <div className="zen-empty-icon">✨</div>
      <div className="zen-empty-title">No active tasks</div>
      <div className="zen-empty-subtitle">Running subagents and tasks will appear here</div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

const MAX_EVENTS = 50
const BATCH_DELAY_MS = 100

export function ZenActivityPanel() {
  // Active tasks from sessions
  const { sessions, connected } = useSessionsStream(true)
  const { tasks, runningTasks, getTaskOpacity } = useActiveTasks({
    sessions,
    enabled: true,
  })

  // Detail panel state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // SSE event log (collapsed by default)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [showLog, setShowLog] = useState(false)
  const batchedEventsRef = useRef<ActivityEvent[]>([])
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBatch = useCallback(() => {
    if (batchedEventsRef.current.length === 0) return
    const newEvents = [...batchedEventsRef.current]
    batchedEventsRef.current = []
    setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_EVENTS))
  }, [])

  const addEvent = useCallback(
    (event: ActivityEvent) => {
      batchedEventsRef.current.push(event)
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current)
      batchTimeoutRef.current = setTimeout(flushBatch, BATCH_DELAY_MS)
    },
    [flushBatch]
  )

  // Subscribe to SSE events for the log
  useEffect(() => {
    const genId = () => `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const handleCreated = (e: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(e.data)
        addEvent({
          id: genId(),
          type: 'created',
          timestamp: Date.now(),
          sessionKey: session.key,
          sessionName: getAgentName(session),
          description: 'Session started',
          icon: getSessionIcon(session),
          details: session.channel ? `via ${session.channel}` : undefined,
        })
      } catch {
        /* ignore */
      }
    }

    const handleUpdated = (e: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(e.data)
        addEvent({
          id: genId(),
          type: 'updated',
          timestamp: Date.now(),
          sessionKey: session.key,
          sessionName: getAgentName(session),
          description: 'Activity',
          icon: getSessionIcon(session),
          details: session.totalTokens
            ? `${session.totalTokens.toLocaleString()} tokens`
            : undefined,
        })
      } catch {
        /* ignore */
      }
    }

    const handleRemoved = (e: MessageEvent) => {
      try {
        const { key } = JSON.parse(e.data)
        addEvent({
          id: genId(),
          type: 'removed',
          timestamp: Date.now(),
          sessionKey: key,
          sessionName: key.split(':').pop() || 'Agent',
          description: 'Session ended',
          icon: '🔴',
        })
      } catch {
        /* ignore */
      }
    }

    const unsub1 = sseManager.subscribe('session-created', handleCreated)
    const unsub2 = sseManager.subscribe('session-updated', handleUpdated)
    const unsub3 = sseManager.subscribe('session-removed', handleRemoved)

    return () => {
      unsub1()
      unsub2()
      unsub3()
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current)
    }
  }, [addEvent])

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null
    return tasks.find((t) => t.id === selectedTaskId) || null
  }, [selectedTaskId, tasks])

  const selectedSession = useMemo(() => {
    if (!selectedTask?.sessionKey) return null
    return sessions.find((s) => s.key === selectedTask.sessionKey) || null
  }, [selectedTask, sessions])

  const handleTaskSelect = useCallback((task: ActiveTask) => {
    setSelectedTaskId((prev) => (prev === task.id ? null : task.id))
  }, [])

  return (
    <div className={`zen-activity-split ${selectedTask ? 'zen-activity-split-open' : ''}`}>
      <div className="zen-activity-panel">
        {/* Header */}
        <div className="zen-activity-header">
          <div className="zen-activity-status">
            <span
              className={`zen-status-dot ${connected ? 'zen-status-dot-active' : 'zen-status-dot-error'}`}
            />
            <span>
              {runningTasks.length} active task{runningTasks.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="zen-activity-controls">
            <button
              type="button"
              className={`zen-btn zen-btn-small ${showLog ? 'zen-btn-active' : ''}`}
              onClick={() => setShowLog((v) => !v)}
              title="Toggle event log"
            >
              Log {showLog ? '▾' : '▸'}
            </button>
          </div>
        </div>

        {/* Active Tasks */}
        {tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="zen-active-tasks-list">
            {tasks.map((task) => (
              <ActiveTaskItem
                key={task.id}
                task={task}
                opacity={getTaskOpacity(task)}
                isSelected={task.id === selectedTaskId}
                onSelect={() => handleTaskSelect(task)}
              />
            ))}
          </div>
        )}

        {/* Collapsible Event Log */}
        {showLog && (
          <div className="zen-activity-log-section">
            <div className="zen-activity-log-header">
              <span>Event Log</span>
              {events.length > 0 && (
                <button
                  type="button"
                  className="zen-btn zen-btn-small"
                  onClick={() => {
                    setEvents([])
                    batchedEventsRef.current = []
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="zen-activity-list">
              {events.length === 0 ? (
                <div className="zen-activity-log-empty">No events yet</div>
              ) : (
                events.map((event) => <EventLogItem key={event.id} event={event} />)
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="zen-activity-footer">
          <span className="zen-activity-count">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
            {events.length > 0 && ` · ${events.length} event${events.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTask && (
        <ZenActivityDetailPanel
          task={selectedTask}
          session={selectedSession}
          events={events}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
