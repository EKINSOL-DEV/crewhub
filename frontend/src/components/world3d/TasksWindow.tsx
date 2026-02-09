import { useState, useCallback, useRef, useEffect } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { ActiveTask } from '@/hooks/useActiveTasks'

// ── Types ──────────────────────────────────────────────────────

interface TasksWindowProps {
  tasks: ActiveTask[]
  getTaskOpacity: (task: ActiveTask) => number
  getRoomForSession: (sessionKey: string) => string | undefined
  defaultRoomId?: string
  onClose: () => void
}

interface Position {
  x: number
  y: number
}

// ── Constants ──────────────────────────────────────────────────

const MIN_WIDTH = 220
const MAX_WIDTH = 500
const DEFAULT_WIDTH = 380
const MIN_HEIGHT = 150
const MAX_HEIGHT = 550
const DEFAULT_HEIGHT = 350

// ── Main Component ─────────────────────────────────────────────

export function TasksWindow({
  tasks,
  getTaskOpacity,
  getRoomForSession,
  defaultRoomId,
  onClose,
}: TasksWindowProps) {
  const { focusBot } = useWorldFocus()
  const [position, setPosition] = useState<Position>({ x: 80, y: 120 })
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizingRef = useRef<'width' | 'height' | 'both' | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Sort: running first, then done (sorted by doneAt desc)
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (a.status !== 'running' && b.status === 'running') return 1
    if (a.status === 'done' && b.status === 'done') {
      return (b.doneAt || 0) - (a.doneAt || 0)
    }
    return 0
  })

  const runningCount = sortedTasks.filter(t => t.status === 'running').length

  // Click handler → focus on the bot
  const handleTaskClick = useCallback((task: ActiveTask) => {
    if (!task.sessionKey) return
    const roomId = getRoomForSession(task.sessionKey) || defaultRoomId || 'headquarters'
    focusBot(task.sessionKey, roomId)
  }, [focusBot, getRoomForSession, defaultRoomId])

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPosition({
        x: Math.max(0, dragStartRef.current.posX + dx),
        y: Math.max(0, dragStartRef.current.posY + dy),
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = 'both'
    resizeStartRef.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height }

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - resizeStartRef.current.x
      const dy = e.clientY - resizeStartRef.current.y

      setSize({
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width + dx)),
        height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStartRef.current.height + dy)),
      })
    }

    const handleMouseUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [size])

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 15,
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header (draggable) */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(0, 0, 0, 0.03)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          cursor: isDragging ? 'grabbing' : 'grab',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>📋</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#1f2937',
            }}
          >
            Active Tasks
          </span>
          {runningCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#3b82f6',
                background: 'rgba(59, 130, 246, 0.12)',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {runningCount} running
            </span>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#6b7280',
            fontSize: 16,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)'
            e.currentTarget.style.color = '#374151'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#6b7280'
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {sortedTasks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 24,
              color: 'rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📭</span>
            <span style={{ fontSize: 13 }}>No active tasks</span>
            <span style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
              Tasks will appear here when agents are working
            </span>
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
        data-resize-handle
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 20,
          height: 20,
          cursor: 'nwse-resize',
          background: `linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.08) 60%, transparent 60%),
                       linear-gradient(135deg, transparent 60%, rgba(0,0,0,0.08) 60%)`,
          borderRadius: '0 0 14px 0',
        }}
      />
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

  const displayTitle =
    task.title.length > 40 ? task.title.slice(0, 38) + '…' : task.title

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 10px',
        border: 'none',
        borderRadius: 8,
        background: isRunning ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        opacity,
        transition: 'opacity 0.5s ease, background 0.15s ease',
        fontFamily: 'inherit',
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isRunning
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(0, 0, 0, 0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isRunning
          ? 'rgba(59, 130, 246, 0.08)'
          : 'transparent'
      }}
      title={`Click to focus on ${task.agentName || 'agent'}`}
    >
      {/* Status indicator */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {isRunning ? (
          <span
            style={{
              animation: 'spin 1s linear infinite',
              display: 'inline-block',
            }}
          >
            ⚙️
          </span>
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
              color: 'rgba(0, 0, 0, 0.45)',
              marginTop: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>{task.agentIcon}</span>
            <span>{task.agentName}</span>
          </div>
        )}
      </div>

      {/* Arrow indicator */}
      <span style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.2)' }}>→</span>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
