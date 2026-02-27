import { useState, useMemo, useCallback } from 'react'
import {
  useTasks,
  type Task,
  type TaskStatus,
  type TaskCreate,
  type TaskUpdate,
} from '@/hooks/useTasks'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'

// ── Column Config ──────────────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  headerBg: string
  headerColor: string
}

const columns: ColumnConfig[] = [
  { status: 'todo', label: 'To Do', icon: '📋', headerBg: '#f3f4f6', headerColor: '#4b5563' },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: '🔄',
    headerBg: '#dbeafe',
    headerColor: '#1d4ed8',
  },
  { status: 'review', label: 'Review', icon: '👀', headerBg: '#ede9fe', headerColor: '#6d28d9' },
  { status: 'done', label: 'Done', icon: '✅', headerBg: '#dcfce7', headerColor: '#15803d' },
]

// ── Props ──────────────────────────────────────────────────────

interface TaskBoardProps {
  readonly projectId: string
  readonly roomId?: string
  readonly agents?: Array<{ session_key: string; display_name: string }>
  readonly compact?: boolean
  readonly maxTasksPerColumn?: number
  readonly onTaskClick?: (task: Task) => void
}

// ── Component ──────────────────────────────────────────────────

export function TaskBoard({
  projectId,
  roomId,
  agents = [],
  compact = false,
  maxTasksPerColumn = 10,
  onTaskClick,
}: TaskBoardProps) {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, taskCounts } = useTasks({
    projectId,
    roomId,
  })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    }
    for (const task of tasks) {
      grouped[task.status].push(task)
    }
    return grouped
  }, [tasks])

  // Blocked tasks (shown separately)
  const blockedTasks = tasksByStatus.blocked

  // Handle status change (drag-drop alternative)
  const handleStatusChange = useCallback(
    async (task: Task, newStatus: TaskStatus) => {
      const result = await updateTask(task.id, { status: newStatus })
      if (!result.success) {
        console.error('Failed to update task status:', result.error)
      }
    },
    [updateTask]
  )

  // Handle create task
  const handleCreateTask = useCallback(
    async (data: TaskCreate | TaskUpdate) => {
      setFormLoading(true)
      try {
        const result = await createTask(data as TaskCreate)
        if (result.success) {
          setShowCreateForm(false)
        } else {
          throw new Error(result.error)
        }
      } finally {
        setFormLoading(false)
      }
    },
    [createTask]
  )

  // Handle edit task
  const handleEditTask = useCallback(
    async (data: TaskCreate | TaskUpdate) => {
      if (!editingTask) return
      setFormLoading(true)
      try {
        const result = await updateTask(editingTask.id, data as TaskUpdate)
        if (result.success) {
          setEditingTask(null)
        } else {
          throw new Error(result.error)
        }
      } finally {
        setFormLoading(false)
      }
    },
    [editingTask, updateTask]
  )

  // Handle delete task
  const handleDeleteTask = useCallback(
    async (task: Task) => {
      if (!confirm(`Delete task "${task.title}"?`)) return
      const result = await deleteTask(task.id)
      if (!result.success) {
        console.error('Failed to delete task:', result.error)
      }
    },
    [deleteTask]
  )

  // Handle task click
  const handleTaskClick = useCallback(
    (task: Task) => {
      if (onTaskClick) {
        onTaskClick(task)
      } else {
        setEditingTask(task)
      }
    },
    [onTaskClick]
  )

  // Loading state
  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Loading tasks...</div>
    )
  }

  // Error state
  if (error) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#dc2626' }}>Error: {error}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header with Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>📋 Task Board</span>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + Add Task
        </button>
      </div>

      {/* Blocked Tasks Warning */}
      {blockedTasks.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>🚫</span>
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
            {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Kanban Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(4, 1fr)',
          gap: compact ? 8 : 12,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {columns.map((col) => {
          const columnTasks = tasksByStatus[col.status]
          const displayTasks = columnTasks.slice(0, maxTasksPerColumn)
          const hiddenCount = columnTasks.length - displayTasks.length

          return (
            <div
              key={col.status}
              style={{
                background: '#f9fafb',
                borderRadius: 8,
                padding: compact ? 8 : 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: compact ? 100 : 200,
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  background: col.headerBg,
                  borderRadius: 6,
                }}
              >
                <span>{col.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: col.headerColor }}>
                  {col.label}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    fontWeight: 500,
                    color: col.headerColor,
                    background: 'rgba(255,255,255,0.6)',
                    padding: '2px 6px',
                    borderRadius: 10,
                  }}
                >
                  {taskCounts[col.status]}
                </span>
              </div>

              {/* Task Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact={compact}
                    onClick={handleTaskClick}
                    onStatusChange={handleStatusChange}
                  />
                ))}

                {hiddenCount > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6b7280',
                      textAlign: 'center',
                      padding: '8px 0',
                    }}
                  >
                    +{hiddenCount} more
                  </div>
                )}

                {columnTasks.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#9ca3af',
                      textAlign: 'center',
                      padding: '20px 0',
                      fontStyle: 'italic',
                    }}
                  >
                    No tasks
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Blocked Tasks Section (if any) */}
      {blockedTasks.length > 0 && !compact && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#dc2626',
              marginBottom: 8,
            }}
          >
            🚫 Blocked Tasks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blockedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                compact
                showStatus
                onClick={handleTaskClick}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateForm && (
        <button
          type="button"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 65,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateForm(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowCreateForm(false)
          }}
          aria-label="Close create task dialog"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            role="dialog"
            aria-modal="true"
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#1f2937' }}>Create New Task</h3>
            <TaskForm
              mode="create"
              projectId={projectId}
              roomId={roomId}
              agents={agents}
              onSubmit={handleCreateTask}
              onCancel={() => setShowCreateForm(false)}
              isLoading={formLoading}
            />
          </div>
        </button>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <button
          type="button"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 65,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTask(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditingTask(null)
          }}
          aria-label="Close edit task dialog"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            role="dialog"
            aria-modal="true"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Edit Task</h3>
              <button
                onClick={() => handleDeleteTask(editingTask)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
            <TaskForm
              mode="edit"
              projectId={projectId}
              roomId={roomId}
              initialData={editingTask}
              agents={agents}
              onSubmit={handleEditTask}
              onCancel={() => setEditingTask(null)}
              isLoading={formLoading}
            />
          </div>
        </button>
      )}
    </div>
  )
}
