import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useTasks, type Task, type TaskStatus, type TaskUpdate } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { HQTaskBoard } from './HQTaskBoard'
import { TaskForm } from './TaskForm'
import { Building2, Loader2, Filter, ArrowUpDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSessionKeyAsName, isFixedAgent } from '@/lib/friendlyNames'

// ── Props ──────────────────────────────────────────────────────

interface HQTaskBoardOverlayProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

// ── Sorting Options ────────────────────────────────────────────

type SortOption = 'active' | 'name' | 'recent'

const sortOptions: { value: SortOption; label: string; icon: string }[] = [
  { value: 'active', label: 'Most Active', icon: '🔥' },
  { value: 'name', label: 'Name A-Z', icon: '🔤' },
  { value: 'recent', label: 'Recently Updated', icon: '🕐' },
]

// ── Component ──────────────────────────────────────────────────

export function HQTaskBoardOverlay({ open, onOpenChange }: HQTaskBoardOverlayProps) {
  // Fetch ALL tasks (no project filter)
  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    updateTask,
  } = useTasks({ autoFetch: open })

  // Fetch all projects
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjects()

  // UI State
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('active')
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filter tasks by selected projects
  const filteredTasks = useMemo(() => {
    if (selectedProjects.size === 0) return tasks
    return tasks.filter((t) => selectedProjects.has(t.project_id))
  }, [tasks, selectedProjects])

  // Build agents list from task assignments (for the assignee dropdown)
  // Only include fixed/permanent agents, not temporary subagents
  const agents = useMemo(() => {
    const agentMap = new Map<string, string>()

    for (const task of tasks) {
      if (task.assigned_session_key && isFixedAgent(task.assigned_session_key)) {
        // Use assigned_display_name if available, otherwise format the session key
        const displayName =
          task.assigned_display_name || formatSessionKeyAsName(task.assigned_session_key)
        agentMap.set(task.assigned_session_key, displayName)
      }
    }

    return Array.from(agentMap.entries()).map(([session_key, display_name]) => ({
      session_key,
      display_name,
    }))
  }, [tasks])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const filtered =
      selectedProjects.size === 0 ? projects : projects.filter((p) => selectedProjects.has(p.id))

    // Sort projects
    const tasksByProject = new Map<string, Task[]>()
    for (const project of filtered) {
      tasksByProject.set(
        project.id,
        filteredTasks.filter((t) => t.project_id === project.id)
      )
    }

    switch (sortBy) {
      case 'active':
        return [...filtered].sort((a, b) => {
          const aTasks = tasksByProject.get(a.id) || []
          const bTasks = tasksByProject.get(b.id) || []
          const aActive = aTasks.filter((t) => t.status !== 'done').length
          const bActive = bTasks.filter((t) => t.status !== 'done').length
          return bActive - aActive
        })
      case 'name':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
      case 'recent':
        return [...filtered].sort((a, b) => b.updated_at - a.updated_at)
      default:
        return filtered
    }
  }, [projects, selectedProjects, filteredTasks, sortBy])

  // Toggle project selection
  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  // Toggle project collapse
  const toggleProjectCollapse = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedProjects(new Set())
  }, [])

  // Handle task click
  const handleTaskClick = useCallback((task: Task) => {
    setEditingTask(task)
  }, [])

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

  // Handle edit task
  const handleEditTask = useCallback(
    async (data: TaskUpdate) => {
      if (!editingTask) return
      setFormLoading(true)
      try {
        const result = await updateTask(editingTask.id, data)
        if (result.success) {
          setEditingTask(null)
        }
      } finally {
        setFormLoading(false)
      }
    },
    [editingTask, updateTask]
  )

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.all([refreshTasks(), refreshProjects()])
    setTimeout(() => setIsRefreshing(false), 500)
  }, [refreshTasks, refreshProjects])

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
    if (!editingTask) {
      onOpenChange(false)
    }
  }, [onOpenChange, editingTask])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget && !editingTask) {
        onOpenChange(false)
      }
    },
    [onOpenChange, editingTask]
  )

  // Stats
  const totalTasks = filteredTasks.length
  const activeTasks = filteredTasks.filter((t) => t.status !== 'done').length
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress').length
  const blockedTasks = filteredTasks.filter((t) => t.status === 'blocked').length

  const isLoading = tasksLoading || projectsLoading
  const error = tasksError || projectsError

  return (
    <dialog // NOSONAR: <dialog> is a native interactive HTML element
      ref={dialogRef}
      onClose={handleDialogClose}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !editingTask) onOpenChange(false)
      }}
      className="
        fixed inset-0 z-[60] m-0 h-screen w-screen max-h-none max-w-none
        bg-transparent p-0
        backdrop:bg-black/80 backdrop:backdrop-blur-none
        open:flex open:items-center open:justify-center
      "
    >
      {/* Dialog content panel */}
      <div className="w-[calc(100vw-2rem)] max-w-[1800px] h-[calc(100vh-2rem)] max-h-[1000px] flex flex-col p-0 gap-0 rounded-lg border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                🏛️ HQ Command Center
              </h2>
              <p className="text-xs text-muted-foreground">
                {filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'} ·{' '}
                {totalTasks} tasks · {activeTasks} active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </button>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                showFilters
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {selectedProjects.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                  {selectedProjects.size}
                </span>
              )}
            </button>

            {/* Sort dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <ArrowUpDown className="w-4 h-4" />
                {sortOptions.find((o) => o.value === sortBy)?.icon}{' '}
                {sortOptions.find((o) => o.value === sortBy)?.label}
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg',
                      sortBy === option.value &&
                        'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    )}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel (collapsible) */}
        {showFilters && (
          <div className="px-6 py-3 border-b bg-gray-50 dark:bg-gray-900/50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">
                Filter by Project
              </span>
              {selectedProjects.size > 0 && (
                <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => {
                const isSelected = selectedProjects.has(project.id)
                const taskCount = filteredTasks.filter((t) => t.project_id === project.id).length

                return (
                  <button
                    key={project.id}
                    onClick={() => toggleProjectSelection(project.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border',
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: project.color || '#6b7280' }}
                    />
                    <span>{project.icon || '📋'}</span>
                    <span className="font-medium">{project.name}</span>
                    <span className="text-xs text-gray-400">{taskCount}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Stats Bar */}
        {blockedTasks > 0 && (
          <div className="mx-6 mt-4 px-4 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <span className="text-lg">🚫</span>
            <span className="font-medium text-red-700 dark:text-red-300">
              {blockedTasks} blocked task{blockedTasks > 1 ? 's' : ''} across projects
            </span>
          </div>
        )}

        {/* Board Content */}
        <div className="flex-1 overflow-hidden p-6">
          {(() => {
            if (isLoading) {
              return (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )
            }

            if (error) {
              return (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-sm text-destructive">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                  >
                    Retry
                  </button>
                </div>
              )
            }

            return (
              <HQTaskBoard
                tasks={filteredTasks}
                projects={filteredProjects}
                onTaskClick={handleTaskClick}
                onStatusChange={handleStatusChange}
                collapsedProjects={collapsedProjects}
                onToggleProject={toggleProjectCollapse}
              />
            )
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>📊 {totalTasks} total</span>
              <span>·</span>
              <span className="text-blue-600">🔄 {inProgressTasks} in progress</span>
              <span>·</span>
              <span className="text-green-600">
                ✅ {filteredTasks.filter((t) => t.status === 'done').length} done
              </span>
              {blockedTasks > 0 && (
                <>
                  <span>·</span>
                  <span className="text-red-600">🚫 {blockedTasks} blocked</span>
                </>
              )}
            </div>
            <span className="text-[10px]">
              {selectedProjects.size > 0
                ? `Showing ${selectedProjects.size} of ${projects.length} projects`
                : `All ${projects.length} projects`}
            </span>
          </div>
        </div>

        {/* Edit Task Modal */}
        {editingTask && (
          <button
            type="button"
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingTask(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingTask(null)
            }}
          >
            <div
              className="bg-background rounded-xl p-6 w-[90%] max-w-md max-h-[80vh] overflow-auto shadow-xl"
              aria-modal="true"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Task</h3>
                <div className="flex items-center gap-2">
                  {/* Show which project this task belongs to */}
                  {(() => {
                    const project = projects.find((p) => p.id === editingTask.project_id)
                    return project ? (
                      <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: project.color || '#6b7280' }}
                        />
                        {project.icon} {project.name}
                      </span>
                    ) : null
                  })()}
                </div>
              </div>
              <TaskForm
                mode="edit"
                projectId={editingTask.project_id}
                roomId={editingTask.room_id || undefined}
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
    </dialog>
  )
}
