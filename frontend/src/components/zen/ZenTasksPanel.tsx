/**
 * Zen Tasks Panel
 * Compact task list with quick actions
 */

import { useCallback, useState, useMemo } from 'react'
import { useTasks, type Task, type TaskStatus, type TaskPriority } from '@/hooks/useTasks'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/lib/taskConstants'
import { ProjectFilterSelect } from './ProjectFilterSelect'

interface ZenTasksPanelProps {
  readonly projectId?: string
  readonly roomId?: string
  readonly roomFocusName?: string // Name of the focused room's project (for display)
  readonly onTaskClick?: (task: Task) => void
  readonly onProjectFilterChange?: (
    projectId: string | null,
    projectName: string,
    projectColor?: string
  ) => void
}

const COLUMNS: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'todo', label: 'To Do', icon: '📋' },
  { status: 'in_progress', label: 'In Progress', icon: '🔄' },
  { status: 'review', label: 'Review', icon: '👀' },
  { status: 'blocked', label: 'Blocked', icon: '⚠️' },
  { status: 'done', label: 'Done', icon: '✅' },
]

// ── Task Item Component ──────────────────────────────────────────

interface TaskItemProps {
  readonly task: Task
  readonly onStatusChange: (newStatus: TaskStatus) => void
  readonly onClick?: () => void
  readonly isSelected?: boolean
}

function TaskItem({ task, onStatusChange, onClick, isSelected }: Readonly<TaskItemProps>) {
  const status = STATUS_CONFIG[task.status]
  const priority = PRIORITY_CONFIG[task.priority]

  const handleQuickDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStatusChange('done')
  }

  const handleQuickBlock = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStatusChange('blocked')
  }

  return (
    <div
      className={`zen-task-item zen-task-status-${task.status}${isSelected ? ' zen-task-item-selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className="zen-task-status-icon" style={{ color: status.color }}>
        {status.icon}
      </div>

      <div className="zen-task-content">
        <div className="zen-task-title">{task.title}</div>
        <div className="zen-task-meta">
          {task.assigned_display_name && (
            <span className="zen-task-assignee">👤 {task.assigned_display_name}</span>
          )}
          <span className="zen-task-priority" style={{ color: priority.color }}>
            {priority.label}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      {task.status !== 'done' && (
        <div className="zen-task-actions">
          {(task.status === 'in_progress' || task.status === 'review') && (
            <button
              className="zen-task-action zen-task-action-done"
              onClick={handleQuickDone}
              title="Mark as done"
            >
              ✓
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              className="zen-task-action zen-task-action-block"
              onClick={handleQuickBlock}
              title="Mark as blocked"
            >
              ⚠
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Status Filter Tabs ───────────────────────────────────────────

interface StatusTabsProps {
  readonly activeStatus: TaskStatus | 'all'
  readonly counts: Record<TaskStatus, number>
  readonly onChange: (status: TaskStatus | 'all') => void
}

function StatusTabs({ activeStatus, counts, onChange }: Readonly<StatusTabsProps>) {
  const tabs: (TaskStatus | 'all')[] = ['all', 'todo', 'in_progress', 'review', 'done', 'blocked']

  return (
    <div className="zen-tasks-tabs">
      {tabs.map((status) => {
        const isAll = status === 'all'
        const count = isAll ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[status]
        const config = isAll ? { icon: '📊', label: 'All' } : STATUS_CONFIG[status]

        return (
          <button
            key={status}
            className={`zen-tasks-tab ${activeStatus === status ? 'zen-tasks-tab-active' : ''}`}
            onClick={() => onChange(status)}
            title={config.label}
          >
            <span className="zen-tasks-tab-icon">{config.icon}</span>
            {count > 0 && <span className="zen-tasks-tab-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState({ filterActive }: { filterActive: boolean }) {
  return (
    <div className="zen-tasks-empty">
      <div className="zen-empty-icon">✅</div>
      <div className="zen-empty-title">{filterActive ? 'No tasks match filter' : 'No tasks'}</div>
      <div className="zen-empty-subtitle">
        {filterActive ? 'Try a different status filter' : 'Tasks will appear here'}
      </div>
    </div>
  )
}

// ── Loading State ────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="zen-tasks-loading">
      <div className="zen-thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span>Loading tasks...</span>
    </div>
  )
}

// ── Task Detail Pane ─────────────────────────────────────────────

interface TaskDetailPaneProps {
  readonly task: Task
  readonly onClose: () => void
  readonly onMove: (newStatus: TaskStatus) => void
}

function TaskDetailPane({ task, onClose, onMove }: Readonly<TaskDetailPaneProps>) {
  const status = STATUS_CONFIG[task.status]
  const priority = PRIORITY_CONFIG[task.priority]

  return (
    <div className="zen-task-detail-pane">
      <div className="zen-task-detail-header">
        <h4 className="zen-task-detail-title">{task.title}</h4>
        <button className="zen-task-detail-close" onClick={onClose} title="Close details">
          ✕
        </button>
      </div>

      <div className="zen-task-detail-content">
        <div className="zen-task-detail-row">
          <span className="zen-task-detail-label">Status:</span>
          <span className="zen-task-detail-value" style={{ color: status.color }}>
            {status.icon} {status.label}
          </span>
        </div>

        <div className="zen-task-detail-row">
          <span className="zen-task-detail-label">Priority:</span>
          <span className="zen-task-detail-value" style={{ color: priority.color }}>
            {priority.label}
          </span>
        </div>

        {task.assigned_display_name && (
          <div className="zen-task-detail-row">
            <span className="zen-task-detail-label">Assignee:</span>
            <span className="zen-task-detail-value">👤 {task.assigned_display_name}</span>
          </div>
        )}

        {task.description && (
          <div className="zen-task-detail-description">
            <span className="zen-task-detail-label">Description:</span>
            <p>{task.description}</p>
          </div>
        )}

        <div className="zen-task-detail-actions">
          <span className="zen-task-detail-label">Move to:</span>
          <div className="zen-task-detail-buttons">
            {COLUMNS.filter((col) => col.status !== task.status).map((col) => (
              <button
                key={col.status}
                className="zen-btn zen-btn-sm"
                onClick={() => onMove(col.status)}
              >
                {col.icon} {col.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

export function ZenTasksPanel({
  projectId,
  roomId,
  roomFocusName,
  onTaskClick,
  onProjectFilterChange,
}: Readonly<ZenTasksPanelProps>) {
  const { tasks, isLoading, error, updateTask, taskCounts, refresh } = useTasks({
    projectId,
    roomId,
  })
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      // Search filter
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tasks, statusFilter, search])

  // Sort: priority (urgent first), then by updated_at
  const sortedTasks = useMemo(() => {
    const priorityOrder: Record<TaskPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    return [...filteredTasks].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.updated_at - a.updated_at
    })
  }, [filteredTasks])

  const handleStatusChange = useCallback(
    async (task: Task, newStatus: TaskStatus) => {
      await updateTask(task.id, { status: newStatus })
      // Update selected task if it was the one that changed
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...task, status: newStatus })
      }
    },
    [updateTask, selectedTask]
  )

  const handleTaskClick = useCallback(
    (task: Task) => {
      setSelectedTask(task)
      onTaskClick?.(task)
    },
    [onTaskClick]
  )

  // Error state
  if (error) {
    return (
      <div className="zen-tasks-panel">
        <div className="zen-tasks-error">
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
      <div className="zen-tasks-panel">
        <LoadingState />
      </div>
    )
  }

  return (
    <div className="zen-tasks-panel">
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

      {/* Search bar */}
      <div className="zen-tasks-filter">
        <input
          type="text"
          className="zen-tasks-search"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status tabs */}
      <StatusTabs activeStatus={statusFilter} counts={taskCounts} onChange={setStatusFilter} />

      {/* Task list */}
      {sortedTasks.length === 0 ? (
        <EmptyState filterActive={statusFilter !== 'all' || search !== ''} />
      ) : (
        <div className="zen-tasks-list">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onStatusChange={(status) => handleStatusChange(task, status)}
              onClick={() => handleTaskClick(task)}
              isSelected={selectedTask?.id === task.id}
            />
          ))}
        </div>
      )}

      {/* Footer with count */}
      <div className="zen-tasks-footer">
        <span className="zen-tasks-count">
          {sortedTasks.length} task{sortedTasks.length === 1 ? '' : 's'}
          {statusFilter !== 'all' && ` (${statusFilter.replace('_', ' ')})`}
        </span>
      </div>

      {/* Task detail pane (bottom) */}
      {selectedTask && (
        <TaskDetailPane
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onMove={(status) => {
            handleStatusChange(selectedTask, status)
            setSelectedTask(null)
          }}
        />
      )}
    </div>
  )
}
