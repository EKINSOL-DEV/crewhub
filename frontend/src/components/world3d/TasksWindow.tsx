import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTasks, type Task, type TaskStatus, type TaskPriority } from '@/hooks/useTasks'

// ── Types ──────────────────────────────────────────────────────

interface TasksWindowProps {
  projectId?: string
  roomId?: string
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

const STATUS_ICONS: Record<TaskStatus, string> = {
  todo: '📋',
  in_progress: '🔄',
  review: '👀',
  done: '✅',
  blocked: '⚠️',
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444',
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// ── Main Component ─────────────────────────────────────────────

export function TasksWindow({ projectId, roomId, onClose }: TasksWindowProps) {
  const { tasks, isLoading } = useTasks({ projectId, roomId })
  const [position, setPosition] = useState<Position>({ x: 80, y: 120 })
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizingRef = useRef<'width' | 'height' | 'both' | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Filter to active tasks (in_progress, review, blocked) and sort by priority
  const activeTasks = useMemo(() => {
    const activeStatuses: TaskStatus[] = ['in_progress', 'review', 'blocked']
    return tasks
      .filter((t) => activeStatuses.includes(t.status))
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return b.updated_at - a.updated_at
      })
  }, [tasks])

  const inProgressCount = activeTasks.filter((t) => t.status === 'in_progress').length

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      e.preventDefault()
      setIsDragging(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y }
    },
    [position]
  )

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
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizingRef.current = 'both'
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      }

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
    },
    [size]
  )

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
          {inProgressCount > 0 && (
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
              {inProgressCount} in progress
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
        {isLoading && activeTasks.length === 0 ? (
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
            <span style={{ fontSize: 13 }}>Loading tasks...</span>
          </div>
        ) : activeTasks.length === 0 ? (
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
            <span style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>✅</span>
            <span style={{ fontSize: 13 }}>No active tasks</span>
            <span style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
              Tasks in progress will appear here
            </span>
          </div>
        ) : (
          activeTasks.map((task) => <TaskItem key={task.id} task={task} />)
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
  task: Task
}

function TaskItem({ task }: TaskItemProps) {
  const statusIcon = STATUS_ICONS[task.status]
  const statusColor = STATUS_COLORS[task.status]

  const displayTitle = task.title.length > 50 ? task.title.slice(0, 48) + '…' : task.title

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 10px',
        borderRadius: 8,
        background:
          task.status === 'in_progress'
            ? 'rgba(59, 130, 246, 0.08)'
            : task.status === 'blocked'
              ? 'rgba(239, 68, 68, 0.08)'
              : 'transparent',
        marginBottom: 2,
      }}
    >
      {/* Status indicator */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>{statusIcon}</span>

      {/* Task info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: statusColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayTitle}
        </div>
        {task.assigned_display_name && (
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
            <span>👤</span>
            <span>{task.assigned_display_name}</span>
          </div>
        )}
      </div>

      {/* Priority badge */}
      {(task.priority === 'urgent' || task.priority === 'high') && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: task.priority === 'urgent' ? '#ef4444' : '#f59e0b',
            background:
              task.priority === 'urgent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            padding: '1px 4px',
            borderRadius: 3,
            flexShrink: 0,
          }}
        >
          {task.priority === 'urgent' ? 'URG' : 'HI'}
        </span>
      )}
    </div>
  )
}
