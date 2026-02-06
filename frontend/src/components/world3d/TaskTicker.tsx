import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
}

// ── Constants ──────────────────────────────────────────────────

const MIN_WIDTH = 200
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 280
const MIN_HEIGHT = 100
const MAX_HEIGHT = 400
const DEFAULT_HEIGHT = 200
const FADE_OUT_DURATION = 30000

// ── Component ──────────────────────────────────────────────────

export function TaskTicker({
  sessions,
  getRoomForSession,
  defaultRoomId,
}: TaskTickerProps) {
  const { focusBot } = useWorldFocus()
  const [isOpen, setIsOpen] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const resizingRef = useRef<'width' | 'height' | 'both' | null>(null)
  const startPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const { tasks, getTaskOpacity } = useActiveTasks({
    sessions,
    fadeOutDuration: FADE_OUT_DURATION,
    enabled: true,
  })

  // Force re-render every second to update fade-out opacity
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(interval)
  }, [isOpen])

  // Click handler → focus on the bot
  const handleTaskClick = useCallback((task: ActiveTask) => {
    if (!task.sessionKey) return
    const roomId = getRoomForSession(task.sessionKey) || defaultRoomId || 'headquarters'
    focusBot(task.sessionKey, roomId)
  }, [focusBot, getRoomForSession, defaultRoomId])

  // Sort: running first, then done (sorted by doneAt desc)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1
      if (a.status !== 'running' && b.status === 'running') return 1
      if (a.status === 'done' && b.status === 'done') {
        return (b.doneAt || 0) - (a.doneAt || 0)
      }
      return 0
    })
  }, [tasks])

  const runningCount = sortedTasks.filter(t => t.status === 'running').length
  const totalCount = sortedTasks.length

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'width' | 'height' | 'both') => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = direction
    startPosRef.current = { x: e.clientX, y: e.clientY, width, height }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - startPosRef.current.x
      const dy = e.clientY - startPosRef.current.y

      if (resizingRef.current === 'width' || resizingRef.current === 'both') {
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startPosRef.current.width + dx)))
      }
      if (resizingRef.current === 'height' || resizingRef.current === 'both') {
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startPosRef.current.height + dy)))
      }
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [width, height])

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        left: 16,
        zIndex: 45,
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: runningCount > 0 ? '#1d4ed8' : '#374151',
          background: runningCount > 0 ? 'rgba(219, 234, 254, 0.9)' : 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
          fontFamily: 'system-ui, sans-serif',
        }}
        title={isOpen ? 'Hide active tasks' : 'Show active tasks'}
      >
        {runningCount > 0 ? (
          <>
            <span style={{ animation: 'pulse 2s infinite' }}>⚡</span>
            {runningCount} running
          </>
        ) : totalCount > 0 ? (
          <>📋 {totalCount} tasks</>
        ) : (
          <>📋 Tasks</>
        )}
        <span style={{ fontSize: 10, opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div
          style={{
            marginTop: 8,
            width,
            height: totalCount === 0 ? 'auto' : height,
            minHeight: 60,
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 12px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(0, 0, 0, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
            }}
          >
            Active Tasks {runningCount > 0 && `(${runningCount} running)`}
          </div>

          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
            {sortedTasks.length === 0 ? (
              <div style={{ 
                padding: 16, 
                textAlign: 'center', 
                color: 'rgba(0,0,0,0.4)',
                fontSize: 12,
              }}>
                No active tasks
              </div>
            ) : (
              sortedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  opacity={getTaskOpacity(task)}
                  onClick={() => handleTaskClick(task)}
                />
              ))
            )}
          </div>

          {/* Resize handle (bottom-right corner) */}
          <div
            onMouseDown={(e) => handleResizeStart(e, 'both')}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 16,
              height: 16,
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)',
              borderRadius: '0 0 12px 0',
            }}
          />
        </div>
      )}

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
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
  
  const displayTitle = task.title.length > 35
    ? task.title.slice(0, 33) + '…'
    : task.title

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 8,
        background: isRunning ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        opacity,
        transition: 'opacity 0.5s ease, background 0.2s ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isRunning 
          ? 'rgba(59, 130, 246, 0.2)' 
          : 'rgba(0, 0, 0, 0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isRunning 
          ? 'rgba(59, 130, 246, 0.1)' 
          : 'transparent'
      }}
      title={`Click to focus on ${task.agentName || 'agent'}`}
    >
      {/* Status indicator */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {isRunning ? (
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span>
        ) : (
          '✅'
        )}
      </span>

      {/* Task info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: isRunning ? '#1e40af' : '#059669',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayTitle}
        </div>
        {task.agentName && (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(0, 0, 0, 0.4)',
              marginTop: 1,
            }}
          >
            {task.agentIcon} {task.agentName}
          </div>
        )}
      </div>
    </button>
  )
}
