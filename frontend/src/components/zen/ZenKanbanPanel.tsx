/**
 * Zen Kanban Panel
 * Kanban-style task board with columns for each status
 */

import { useCallback, useState, useMemo } from 'react'
import { useTasks, type Task, type TaskStatus } from '@/hooks/useTasks'
import { PRIORITY_CONFIG } from '@/lib/taskConstants'
import { ProjectFilterSelect } from './ProjectFilterSelect'

interface ZenKanbanPanelProps {
  readonly projectId?: string
  readonly roomId?: string
  readonly roomFocusName?: string
  readonly onTaskClick?: (task: Task) => void
  readonly onProjectFilterChange?: (
    projectId: string | null,
    projectName: string,
    projectColor?: string
  ) => void
}

// ── Column Configuration ─────────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  color: string
}

const COLUMNS: ColumnConfig[] = [
  { status: 'todo', label: 'To Do', icon: '📋', color: 'var(--zen-fg-muted)' },
  { status: 'in_progress', label: 'In Progress', icon: '🔄', color: 'var(--zen-info)' },
  { status: 'review', label: 'Review', icon: '👀', color: 'var(--zen-warning)' },
  { status: 'blocked', label: 'Blocked', icon: '⚠️', color: 'var(--zen-error)' },
  { status: 'done', label: 'Done', icon: '✅', color: 'var(--zen-success)' },
]

// ── Kanban Card Component ────────────────────────────────────────

interface KanbanCardProps {
  readonly task: Task
  readonly onMove: (newStatus: TaskStatus) => void
  readonly onExpand: () => void
  readonly isDragging?: boolean
  readonly onDragStart?: () => void
  readonly onDragEnd?: () => void
}

function KanbanCard({
  task,
  onMove,
  onExpand,
  isDragging,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const handleQuickMove = (e: React.MouseEvent, status: TaskStatus) => {
    e.stopPropagation()
    onMove(status)
    setShowMoveMenu(false)
  }

  return (
    <button
      type="button"
      className={`zen-kanban-card ${isDragging ? 'zen-kanban-card-dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onDragEnd={onDragEnd}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onExpand()
        }
      }}
    >
      <div className="zen-kanban-card-header">
        <span
          className="zen-kanban-card-priority"
          style={{ color: priority.color }}
          title={`Priority: ${task.priority}`}
        >
          {priority.label}
        </span>
        <button
          className="zen-kanban-card-menu"
          onClick={(e) => {
            e.stopPropagation()
            setShowMoveMenu(!showMoveMenu)
          }}
          title="Move to..."
        >
          ⋮
        </button>
      </div>

      <div className="zen-kanban-card-title">{task.title}</div>

      {task.assigned_display_name && (
        <div className="zen-kanban-card-assignee">
          <span className="zen-kanban-card-assignee-icon">👤</span>
          <span className="zen-kanban-card-assignee-name">{task.assigned_display_name}</span>
        </div>
      )}

      {/* Move Menu */}
      {showMoveMenu && (
        <div
          className="zen-kanban-move-menu"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Move task menu"
          tabIndex={-1}
        >
          <div className="zen-kanban-move-header">Move to:</div>
          {COLUMNS.filter((col) => col.status !== task.status).map((col) => (
            <button
              key={col.status}
              className="zen-kanban-move-option"
              onClick={(e) => handleQuickMove(e, col.status)}
            >
              <span>{col.icon}</span>
              <span>{col.label}</span>
            </button>
          ))}
        </div>
      )}
    </button>
  )
}

// ── Kanban Column Component ──────────────────────────────────────

interface KanbanColumnProps {
  readonly config: ColumnConfig
  readonly tasks: Task[]
  readonly onMoveTask: (taskId: string, newStatus: TaskStatus) => void
  readonly onExpandTask: (task: Task) => void
  readonly draggingTaskId: string | null
  readonly onDragOver: (e: React.DragEvent) => void
  readonly onDrop: (e: React.DragEvent) => void
}

function KanbanColumn({
  config,
  tasks,
  onMoveTask,
  onExpandTask,
  draggingTaskId,
  onDragOver,
  onDrop,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
    onDragOver(e)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    onDrop(e)
  }

  return (
    <div
      className={`zen-kanban-column ${isDragOver ? 'zen-kanban-column-dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label={`${config.label} column`}
    >
      <div className="zen-kanban-column-header" style={{ borderColor: config.color }}>
        <span className="zen-kanban-column-icon">{config.icon}</span>
        <span className="zen-kanban-column-label">{config.label}</span>
        <span className="zen-kanban-column-count">{tasks.length}</span>
      </div>

      <div className="zen-kanban-column-cards">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onMove={(status) => onMoveTask(task.id, status)}
            onExpand={() => onExpandTask(task)}
            isDragging={draggingTaskId === task.id}
          />
        ))}

        {tasks.length === 0 && (
          <div className="zen-kanban-empty">
            <span className="zen-kanban-empty-icon">{config.icon}</span>
            <span className="zen-kanban-empty-text">No tasks</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task Detail Modal ────────────────────────────────────────────

interface TaskDetailModalProps {
  readonly task: Task
  readonly onClose: () => void
  readonly onMove: (newStatus: TaskStatus) => void
}

function TaskDetailModal({ task, onClose, onMove }: TaskDetailModalProps) {
  const priority = PRIORITY_CONFIG[task.priority]
  const currentColumn = COLUMNS.find((c) => c.status === task.status)

  return (
    <button
      type="button"
      className="zen-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      aria-label="Close dialog"
    >
      <div className="zen-modal zen-kanban-detail">
        <div className="zen-modal-header">
          <h3 className="zen-modal-title">{task.title}</h3>
          <button className="zen-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="zen-kanban-detail-content">
          <div className="zen-kanban-detail-row">
            <span className="zen-kanban-detail-label">Status:</span>
            <span className="zen-kanban-detail-value" style={{ color: currentColumn?.color }}>
              {currentColumn?.icon} {currentColumn?.label}
            </span>
          </div>

          <div className="zen-kanban-detail-row">
            <span className="zen-kanban-detail-label">Priority:</span>
            <span className="zen-kanban-detail-value" style={{ color: priority.color }}>
              {priority.label}
            </span>
          </div>

          {task.assigned_display_name && (
            <div className="zen-kanban-detail-row">
              <span className="zen-kanban-detail-label">Assignee:</span>
              <span className="zen-kanban-detail-value">👤 {task.assigned_display_name}</span>
            </div>
          )}

          {task.description && (
            <div className="zen-kanban-detail-description">
              <span className="zen-kanban-detail-label">Description:</span>
              <p>{task.description}</p>
            </div>
          )}

          <div className="zen-kanban-detail-actions">
            <span className="zen-kanban-detail-label">Move to:</span>
            <div className="zen-kanban-detail-buttons">
              {COLUMNS.filter((col) => col.status !== task.status).map((col) => (
                <button
                  key={col.status}
                  className="zen-btn zen-btn-sm"
                  onClick={() => {
                    onMove(col.status)
                    onClose()
                  }}
                >
                  {col.icon} {col.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Loading State ────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="zen-kanban-loading">
      <div className="zen-thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span>Loading tasks...</span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export function ZenKanbanPanel({
  projectId,
  roomId,
  roomFocusName,
  onTaskClick,
  onProjectFilterChange,
}: ZenKanbanPanelProps) {
  const { tasks, isLoading, error, updateTask, refresh } = useTasks({ projectId, roomId })
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<Task | null>(null)

  // Group tasks by status, sorted by priority
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
    }

    for (const task of tasks) {
      if (grouped[task.status]) {
        grouped[task.status].push(task)
      }
    }

    // Sort each column by priority
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        const priorityDiff = PRIORITY_CONFIG[a.priority].weight - PRIORITY_CONFIG[b.priority].weight
        if (priorityDiff !== 0) return priorityDiff
        return b.updated_at - a.updated_at
      })
    }

    return grouped
  }, [tasks])

  const handleMoveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      await updateTask(taskId, { status: newStatus })
    },
    [updateTask]
  )

  const handleDrop = useCallback(
    (targetStatus: TaskStatus) => (e: React.DragEvent) => {
      e.preventDefault()
      const taskId = e.dataTransfer.getData('text/plain')
      if (taskId) {
        handleMoveTask(taskId, targetStatus)
      }
      setDraggingTaskId(null)
    },
    [handleMoveTask]
  )

  const handleExpandTask = useCallback(
    (task: Task) => {
      if (onTaskClick) {
        onTaskClick(task)
      } else {
        setExpandedTask(task)
      }
    },
    [onTaskClick]
  )

  // Error state
  if (error) {
    return (
      <div className="zen-kanban-panel">
        <div className="zen-kanban-error">
          <div className="zen-empty-icon">⚠️</div>
          <div className="zen-empty-title">Failed to load tasks</div>
          <button className="zen-btn" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading && tasks.length === 0) {
    return (
      <div className="zen-kanban-panel">
        <LoadingState />
      </div>
    )
  }

  return (
    <div className="zen-kanban-panel">
      {/* Project filter */}
      {onProjectFilterChange && (
        <div
          className="zen-tasks-focus-indicator"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <ProjectFilterSelect
            currentProjectId={projectId}
            currentProjectName={roomFocusName}
            onSelect={onProjectFilterChange}
            compact
          />
        </div>
      )}

      {/* Kanban board */}
      <div className="zen-kanban-board">
        {COLUMNS.map((config) => (
          <KanbanColumn
            key={config.status}
            config={config}
            tasks={tasksByStatus[config.status]}
            onMoveTask={handleMoveTask}
            onExpandTask={handleExpandTask}
            draggingTaskId={draggingTaskId}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(config.status)}
          />
        ))}
      </div>

      {/* Footer with count */}
      <div className="zen-kanban-footer">
        <span className="zen-kanban-count">
          {tasks.length} task{tasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Task detail modal */}
      {expandedTask && (
        <TaskDetailModal
          task={expandedTask}
          onClose={() => setExpandedTask(null)}
          onMove={(status) => handleMoveTask(expandedTask.id, status)}
        />
      )}
    </div>
  )
}
