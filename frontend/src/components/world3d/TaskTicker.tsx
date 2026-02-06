import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useActiveTasks, type ActiveTask } from '@/hooks/useActiveTasks'
import type { CrewSession } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────

interface TaskTickerProps {
  sessions: CrewSession[]
  /** Callback to get room ID for a session (for focus navigation) */
  getRoomForSession: (sessionKey: string) => string | undefined
  /** Default room ID if none found */
  defaultRoomId?: string
  /** Whether the ticker is visible */
  visible?: boolean
}

// ── Constants ──────────────────────────────────────────────────

const MAX_VISIBLE_ITEMS = 5
const ITEM_HEIGHT = 32
const TICKER_WIDTH = 250
const FADE_OUT_DURATION = 30000

// ── Component ──────────────────────────────────────────────────

export function TaskTicker({
  sessions,
  getRoomForSession,
  defaultRoomId,
  visible = true,
}: TaskTickerProps) {
  const { focusBot } = useWorldFocus()
  const { tasks, getTaskOpacity } = useActiveTasks({
    sessions,
    fadeOutDuration: FADE_OUT_DURATION,
    enabled: visible,
  })

  // Force re-render every second to update fade-out opacity
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(interval)
  }, [visible])

  // Click handler → focus on the bot
  const handleTaskClick = useCallback((task: ActiveTask) => {
    if (!task.sessionKey) return
    const roomId = getRoomForSession(task.sessionKey) || defaultRoomId || 'headquarters'
    focusBot(task.sessionKey, roomId)
  }, [focusBot, getRoomForSession, defaultRoomId])

  // Sort: running first, then done (sorted by doneAt desc)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Running tasks come first
      if (a.status === 'running' && b.status !== 'running') return -1
      if (a.status !== 'running' && b.status === 'running') return 1
      // Among done tasks, most recently done first
      if (a.status === 'done' && b.status === 'done') {
        return (b.doneAt || 0) - (a.doneAt || 0)
      }
      return 0
    })
  }, [tasks])

  if (!visible || sortedTasks.length === 0) {
    return null
  }

  const hasOverflow = sortedTasks.length > MAX_VISIBLE_ITEMS

  return (
    <div
      style={{
        position: 'absolute',
        top: 56, // Same level as Walk Around button (right side)
        left: 16,
        zIndex: 45,
        width: TICKER_WIDTH,
        maxHeight: MAX_VISIBLE_ITEMS * ITEM_HEIGHT + 16,
        overflowY: hasOverflow ? 'auto' : 'hidden',
        overflowX: 'hidden',
        borderRadius: 12,
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px 4px',
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(0, 0, 0, 0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        }}
      >
        Active Tasks ({sortedTasks.filter(t => t.status === 'running').length})
      </div>

      {/* Task list */}
      <div style={{ padding: 4 }}>
        {sortedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            opacity={getTaskOpacity(task)}
            onClick={() => handleTaskClick(task)}
          />
        ))}
      </div>
    </div>
  )
}

// ── TaskItem Sub-Component ─────────────────────────────────────

interface TaskItemProps {
  task: ActiveTask
  opacity: number
  onClick: () => void
}

function TaskItem({ task, opacity, onClick }: TaskItemProps) {
  const isRunning = task.status === 'running'
  
  // Truncate title to ~30 chars
  const displayTitle = task.title.length > 30
    ? task.title.slice(0, 28) + '…'
    : task.title

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        opacity,
        transition: 'background 0.15s ease, opacity 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
      title={`${task.title}\nAgent: ${task.agentName}\nClick to focus`}
    >
      {/* Status indicator */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {isRunning ? (
          <SpinnerIcon />
        ) : (
          <span style={{ color: '#22c55e' }}>✓</span>
        )}
      </span>

      {/* Task title */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 500,
          color: isRunning ? '#374151' : '#9ca3af',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayTitle}
      </span>

      {/* Agent badge */}
      {task.agentName && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#6b7280',
            background: 'rgba(0, 0, 0, 0.05)',
            padding: '2px 6px',
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          {task.agentName}
        </span>
      )}
    </button>
  )
}

// ── Spinner Icon ───────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: 'spin 1s linear infinite',
      }}
    >
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="#e5e7eb"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="#6366f1"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
