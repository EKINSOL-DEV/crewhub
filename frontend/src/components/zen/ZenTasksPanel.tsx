/**
 * Zen Tasks Panel
 * Compact task list with quick actions
 */

import { useCallback, useState, useMemo } from 'react'
import { useTasks, type Task, type TaskStatus, type TaskPriority } from '@/hooks/useTasks'

interface ZenTasksPanelProps {
  projectId?: string
  roomId?: string
  roomFocusName?: string  // Name of the focused room's project (for display)
  onTaskClick?: (task: Task) => void
}

// ── Status Configuration ─────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { icon: string; label: string; color: string }> = {
  todo: { icon: '📋', label: 'To Do', color: 'var(--zen-fg-muted)' },
  in_progress: { icon: '🔄', label: 'In Progress', color: 'var(--zen-info)' },
  review: { icon: '👀', label: 'Review', color: 'var(--zen-warning)' },
  done: { icon: '✅', label: 'Done', color: 'var(--zen-success)' },
  blocked: { icon: '⚠️', label: 'Blocked', color: 'var(--zen-error)' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: 'URG', color: 'var(--zen-error)' },
  high: { label: 'HI', color: 'var(--zen-warning)' },
  medium: { label: 'MED', color: 'var(--zen-info)' },
  low: { label: 'LO', color: 'var(--zen-fg-muted)' },
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
  task: Task
  onStatusChange: (newStatus: TaskStatus) => void
  onClick?: () => void
  isSelected?: boolean
}

function TaskItem({ task, onStatusChange, onClick, isSelected }: TaskItemProps) {
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
            <span className="zen-task-assignee">
              👤 {task.assigned_display_name}
            </span>
          )}
          <span 
            className="zen-task-priority"
            style={{ color: priority.color }}
          >
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
  activeStatus: TaskStatus | 'all'
  counts: Record<TaskStatus, number>
  onChange: (status: TaskStatus | 'all') => void
}

function StatusTabs({ activeStatus, counts, onChange }: StatusTabsProps) {
  const tabs: (TaskStatus | 'all')[] = ['all', 'todo', 'in_progress', 'review', 'done', 'blocked']
  
  return (
    <div className="zen-tasks-tabs">
      {tabs.map(status => {
        const isAll = status === 'all'
        const count = isAll 
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : counts[status]
        const config = isAll 
          ? { icon: '📊', label: 'All' }
          : STATUS_CONFIG[status]
        
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
      <div className="zen-empty-title">
        {filterActive ? 'No tasks match filter' : 'No tasks'}
      </div>
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
  task: Task
  onClose: () => void
  onMove: (newStatus: TaskStatus) => void
}

function TaskDetailPane({ task, onClose, onMove }: TaskDetailPaneProps) {
  const status = STATUS_CONFIG[task.status]
  const priority = PRIORITY_CONFIG[task.priority]
  
  return (
    <div className="zen-task-detail-pane">
      <div className="zen-task-detail-header">
        <h4 className="zen-task-detail-title">{task.title}</h4>
        <button 
          className="zen-task-detail-close" 
          onClick={onClose}
          title="Close details"
        >
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
            <span className="zen-task-detail-value">
              👤 {task.assigned_display_name}
            </span>
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
            {COLUMNS.filter(col => col.status !== task.status).map(col => (
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

export function ZenTasksPanel({ projectId, roomId, roomFocusName, onTaskClick }: ZenTasksPanelProps) {
  const { tasks, isLoading, error, updateTask, taskCounts, refresh } = useTasks({ projectId, roomId })
  const isFiltered = !!projectId || !!roomId
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
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
      urgent: 0, high: 1, medium: 2, low: 3
    }
    return [...filteredTasks].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.updated_at - a.updated_at
    })
  }, [filteredTasks])
  
  const handleStatusChange = useCallback(async (task: Task, newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus })
    // Update selected task if it was the one that changed
    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...task, status: newStatus })
    }
  }, [updateTask, selectedTask])
  
  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task)
    onTaskClick?.(task)
  }, [onTaskClick])
  
  // Error state
  if (error) {
    return (
      <div className="zen-tasks-panel">
        <div className="zen-tasks-error">
          <div className="zen-empty-icon">⚠️</div>
          <div className="zen-empty-title">Failed to load tasks</div>
          <button className="zen-btn" onClick={refresh}>Retry</button>
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
      {/* Room focus indicator */}
      {isFiltered && (
        <div className="zen-tasks-focus-indicator">
          <span className="zen-tasks-focus-icon">🔍</span>
          <span className="zen-tasks-focus-label">
            {roomFocusName ? `Tasks: ${roomFocusName}` : 'Filtered Tasks'}
          </span>
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
      <StatusTabs
        activeStatus={statusFilter}
        counts={taskCounts}
        onChange={setStatusFilter}
      />
      
      {/* Task list */}
      {sortedTasks.length === 0 ? (
        <EmptyState filterActive={statusFilter !== 'all' || search !== ''} />
      ) : (
        <div className="zen-tasks-list">
          {sortedTasks.map(task => (
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
          {sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}
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
