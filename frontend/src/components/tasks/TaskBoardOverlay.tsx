import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  useTasks,
  type Task,
  type TaskStatus,
  type TaskCreate,
  type TaskUpdate,
} from '@/hooks/useTasks'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { RunOrSelfDialog } from './RunOrSelfDialog'
import { SpawnAgentDialog } from './SpawnAgentDialog'
import { Plus, Loader2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Column Config ──────────────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  headerBg: string
  headerColor: string
  borderColor: string
}

const columns: ColumnConfig[] = [
  {
    status: 'todo',
    label: 'To Do',
    icon: '📋',
    headerBg: 'bg-gray-100 dark:bg-gray-800',
    headerColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300',
  },
  {
    status: 'in_progress',
    label: 'In Progress',
    icon: '🔄',
    headerBg: 'bg-blue-50 dark:bg-blue-950',
    headerColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-300',
  },
  {
    status: 'review',
    label: 'Review',
    icon: '👀',
    headerBg: 'bg-purple-50 dark:bg-purple-950',
    headerColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-300',
  },
  {
    status: 'done',
    label: 'Done',
    icon: '✅',
    headerBg: 'bg-green-50 dark:bg-green-950',
    headerColor: 'text-green-600 dark:text-green-400',
    borderColor: 'border-green-300',
  },
]

// ── Props ──────────────────────────────────────────────────────

interface TaskBoardOverlayProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly roomId?: string
  readonly agents?: Array<{ session_key: string; display_name: string }>
}

// ── Component ──────────────────────────────────────────────────

export function TaskBoardOverlay({
  open,
  onOpenChange,
  projectId,
  roomId,
  agents = [],
}: TaskBoardOverlayProps) {
  const { tasks, isLoading, error, refresh, createTask, updateTask, deleteTask, taskCounts } =
    useTasks({ projectId, roomId })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [_isRefreshing, setIsRefreshing] = useState(false) // NOSONAR
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)

  // State for the "Run or Self" dialog when dragging todo → in_progress
  const [pendingDropTask, setPendingDropTask] = useState<Task | null>(null)
  const [showRunOrSelfDialog, setShowRunOrSelfDialog] = useState(false)
  const [showSpawnDialogForDrop, setShowSpawnDialogForDrop] = useState(false)

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
    // Sort each column by priority and then by updated_at
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (pDiff !== 0) return pDiff
        return b.updated_at - a.updated_at
      })
    }
    return grouped
  }, [tasks])

  // Blocked tasks
  const blockedTasks = tasksByStatus.blocked

  // Handle status change
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
      setEditingTask(null)
    },
    [deleteTask]
  )

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Drag & Drop handlers
  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(status)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null)
      return
    }

    // Special case: todo → in_progress shows the choice dialog
    if (draggedTask.status === 'todo' && newStatus === 'in_progress') {
      setPendingDropTask(draggedTask)
      setShowRunOrSelfDialog(true)
      setDraggedTask(null)
      return
    }

    // Normal status change
    await handleStatusChange(draggedTask, newStatus)
    setDraggedTask(null)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverColumn(null)
  }

  // RunOrSelf dialog handlers
  const handleRunOrSelfClose = () => {
    setShowRunOrSelfDialog(false)
    setPendingDropTask(null)
  }

  const handleRunWithAgent = () => {
    setShowRunOrSelfDialog(false)
    setShowSpawnDialogForDrop(true)
  }

  const handleDoItMyself = async () => {
    if (pendingDropTask) {
      await handleStatusChange(pendingDropTask, 'in_progress')
    }
    setShowRunOrSelfDialog(false)
    setPendingDropTask(null)
  }

  const handleSpawnFromDrop = (_agentId: string, _sessionKey: string) => {
    // After spawning, the task status is updated by the backend
    // Just close the dialogs
    setShowSpawnDialogForDrop(false)
    setPendingDropTask(null)
    // Refresh to get the updated task status
    refresh()
  }

  // Native dialog ref
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync dialog open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  // Handle native dialog close (ESC key)
  const handleDialogClose = useCallback(() => {
    if (!showCreateForm && !editingTask && !showRunOrSelfDialog && !showSpawnDialogForDrop) {
      onOpenChange(false)
    }
  }, [onOpenChange, showCreateForm, editingTask, showRunOrSelfDialog, showSpawnDialogForDrop])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (
        e.target === e.currentTarget &&
        !showCreateForm &&
        !editingTask &&
        !showRunOrSelfDialog &&
        !showSpawnDialogForDrop
      ) {
        onOpenChange(false)
      }
    },
    [onOpenChange, showCreateForm, editingTask, showRunOrSelfDialog, showSpawnDialogForDrop]
  )

  const totalTasks = tasks.length
  const activeTasks = taskCounts.todo + taskCounts.in_progress + taskCounts.review

  return (
    <dialog // NOSONAR: <dialog> is a native interactive HTML element
      ref={dialogRef}
      onClose={handleDialogClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (
          e.key === 'Escape' &&
          !showCreateForm &&
          !editingTask &&
          !showRunOrSelfDialog &&
          !showSpawnDialogForDrop
        )
          onOpenChange(false)
      }}
      className="
        fixed inset-0 z-[60] m-0 h-screen w-screen max-h-none max-w-none
        bg-transparent p-0
        backdrop:bg-black/80 backdrop:backdrop-blur-none
        open:flex open:items-center open:justify-center
      "
    >
      {/* Dialog content panel */}
      <div // NOSONAR: onClick only prevents event bubble, not interactive
        className="w-[calc(100vw-3rem)] max-w-[1600px] h-[calc(100vh-3rem)] max-h-[900px] flex flex-col p-0 gap-0 rounded-lg border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Maximize2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                📋 Task Board
              </h2>
              <p className="text-xs text-muted-foreground">
                {totalTasks} tasks · {activeTasks} active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* Blocked Tasks Warning */}
        {blockedTasks.length > 0 && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <span className="text-lg">🚫</span>
            <div>
              <span className="font-medium text-red-700 dark:text-red-300">
                {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {blockedTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setEditingTask(task)}
                    className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                  >
                    {task.title.slice(0, 30)}
                    {task.title.length > 30 ? '…' : ''}
                  </button>
                ))}
                {blockedTasks.length > 3 && (
                  <span className="text-xs text-red-600 dark:text-red-400 py-1">
                    +{blockedTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Board Content */}
        <div className="flex-1 overflow-hidden p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full overflow-x-auto">
              {columns.map((col) => {
                const columnTasks = tasksByStatus[col.status]
                const isDropTarget = dragOverColumn === col.status

                return (
                  <div
                    key={col.status}
                    className={cn(
                      'flex flex-col rounded-xl border bg-muted/30 min-h-[400px] transition-all',
                      isDropTarget &&
                        'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50 dark:bg-blue-950/50'
                    )}
                    onDragOver={(e) => handleDragOver(e, col.status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.status)}
                  >
                    {/* Column Header */}
                    <div
                      className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-t-xl',
                        col.headerBg
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{col.icon}</span>
                        <span className={cn('font-semibold text-sm', col.headerColor)}>
                          {col.label}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          col.headerBg,
                          col.headerColor,
                          'bg-white/60 dark:bg-black/20'
                        )}
                      >
                        {taskCounts[col.status]}
                      </span>
                    </div>

                    {/* Task Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <p className="text-sm text-muted-foreground italic">No tasks</p>
                          {col.status === 'todo' && (
                            <button
                              onClick={() => setShowCreateForm(true)}
                              className="mt-2 text-xs text-blue-600 hover:underline"
                            >
                              + Add first task
                            </button>
                          )}
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'cursor-grab active:cursor-grabbing transition-opacity',
                              draggedTask?.id === task.id && 'opacity-50'
                            )}
                          >
                            <TaskCard
                              task={task}
                              compact={false}
                              onClick={(t) => setEditingTask(t)}  // NOSONAR: mouse/drag interaction
                              onStatusChange={handleStatusChange}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>📊 {totalTasks} total</span>
              <span>·</span>
              <span className="text-blue-600">🔄 {taskCounts.in_progress} in progress</span>
              <span>·</span>
              <span className="text-green-600">✅ {taskCounts.done} done</span>
            </div>
            <span className="text-[10px]">Drag tasks between columns to update status</span>
          </div>
        </div>

        {/* Create Task Modal */}
        {showCreateForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            onClick={() => setShowCreateForm(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowCreateForm(false)
            }}
            role="button"
            tabIndex={0}
          >
            <div // NOSONAR: onClick only prevents event bubble, not interactive
              className="bg-background rounded-xl p-6 w-[90%] max-w-md max-h-[80vh] overflow-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-semibold mb-4">Create New Task</h3>
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
          </div>
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            onClick={() => setEditingTask(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingTask(null)
            }}
            role="button"
            tabIndex={0}
          >
            <div // NOSONAR: onClick only prevents event bubble, not interactive
              className="bg-background rounded-xl p-6 w-[90%] max-w-md max-h-[80vh] overflow-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Task</h3>
                <button
                  onClick={() => handleDeleteTask(editingTask)}
                  className="px-3 py-1 text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
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
          </div>
        )}

        {/* Run or Self Dialog - shown when dragging todo → in_progress */}
        {pendingDropTask && (
          <RunOrSelfDialog
            task={pendingDropTask}
            isOpen={showRunOrSelfDialog}
            onClose={handleRunOrSelfClose}
            onRunWithAgent={handleRunWithAgent}
            onDoItMyself={handleDoItMyself}
          />
        )}

        {/* Spawn Agent Dialog - shown when choosing "Run with Agent" from drop */}
        {pendingDropTask && (
          <SpawnAgentDialog
            task={pendingDropTask}
            isOpen={showSpawnDialogForDrop}
            onClose={() => {
              setShowSpawnDialogForDrop(false)
              setPendingDropTask(null)
            }}
            onSpawn={handleSpawnFromDrop}
          />
        )}
      </div>
    </dialog>
  )
}

// ── Compact Preview for BotInfoPanel ───────────────────────────

interface TaskBoardPreviewProps {
  readonly projectId: string
  readonly roomId?: string
  readonly onExpand: () => void
}

export function TaskBoardPreview({ projectId, roomId, onExpand }: TaskBoardPreviewProps) {
  const { tasks, taskCounts, isLoading } = useTasks({ projectId, roomId })

  const activeTasks = tasks.filter((t) => t.status !== 'done').slice(0, 3)
  const totalActive =
    taskCounts.todo + taskCounts.in_progress + taskCounts.review + taskCounts.blocked

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading tasks...</div>
  }

  return (
    <div className="space-y-3">
      {/* Mini status bar */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">📋 {taskCounts.todo}</span>
        <span className="text-blue-500">🔄 {taskCounts.in_progress}</span>
        <span className="text-purple-500">👀 {taskCounts.review}</span>
        <span className="text-green-500">✅ {taskCounts.done}</span>
        {taskCounts.blocked > 0 && <span className="text-red-500">🚫 {taskCounts.blocked}</span>}
      </div>

      {/* Task preview */}
      {activeTasks.length > 0 ? (
        <div className="space-y-2">
          {activeTasks.map((task) => (
            <div key={task.id} className="text-xs p-2 bg-muted/50 rounded-lg truncate">
              <span
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full mr-2',
                  task.priority === 'urgent' && 'bg-red-500',
                  task.priority === 'high' && 'bg-orange-500',
                  task.priority === 'medium' && 'bg-blue-500',
                  task.priority === 'low' && 'bg-gray-400'
                )}
              />
              {task.title}
            </div>
          ))}
          {totalActive > 3 && (
            <div className="text-xs text-muted-foreground text-center">+{totalActive - 3} more</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-2 italic">No active tasks</div>
      )}

      {/* Expand button */}
      <button
        onClick={onExpand}
        className="w-full py-2 px-3 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <Maximize2 className="w-3 h-3" />
        Open Task Board
      </button>
    </div>
  )
}
