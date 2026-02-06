import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Task, TaskStatus } from '@/hooks/useTasks'
import type { Project } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

// ── Column Config ──────────────────────────────────────────────

interface ColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  color: string
  bgColor: string
}

const columns: ColumnConfig[] = [
  { status: 'todo', label: 'To Do', icon: '📋', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  { status: 'in_progress', label: 'In Progress', icon: '🔄', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { status: 'done', label: 'Done', icon: '✅', color: 'text-green-600', bgColor: 'bg-green-50' },
]

// ── Props ──────────────────────────────────────────────────────

interface HQTaskBoardProps {
  tasks: Task[]
  projects: Project[]
  onTaskClick?: (task: Task) => void
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void
  collapsedProjects?: Set<string>
  onToggleProject?: (projectId: string) => void
}

// ── Component ──────────────────────────────────────────────────

export function HQTaskBoard({
  tasks,
  projects,
  onTaskClick,
  onStatusChange,
  collapsedProjects = new Set(),
  onToggleProject,
}: HQTaskBoardProps) {
  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    
    // Initialize with all projects (even empty ones)
    for (const project of projects) {
      grouped.set(project.id, [])
    }
    
    // Add tasks to their projects
    for (const task of tasks) {
      const projectTasks = grouped.get(task.project_id)
      if (projectTasks) {
        projectTasks.push(task)
      } else {
        // Task belongs to unknown/deleted project
        const orphan = grouped.get('_orphan') || []
        orphan.push(task)
        grouped.set('_orphan', orphan)
      }
    }
    
    return grouped
  }, [tasks, projects])

  // Sort projects by active task count (most active first)
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aTasks = tasksByProject.get(a.id) || []
      const bTasks = tasksByProject.get(b.id) || []
      const aActive = aTasks.filter(t => t.status !== 'done').length
      const bActive = bTasks.filter(t => t.status !== 'done').length
      return bActive - aActive
    })
  }, [projects, tasksByProject])

  // Handle local collapse toggle if no external handler
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set())
  const effectiveCollapsed = onToggleProject ? collapsedProjects : localCollapsed
  
  const handleToggle = useCallback((projectId: string) => {
    if (onToggleProject) {
      onToggleProject(projectId)
    } else {
      setLocalCollapsed(prev => {
        const next = new Set(prev)
        if (next.has(projectId)) {
          next.delete(projectId)
        } else {
          next.add(projectId)
        }
        return next
      })
    }
  }, [onToggleProject])

  return (
    <div className="flex flex-col gap-3 h-full overflow-auto">
      {sortedProjects.map(project => {
        const projectTasks = tasksByProject.get(project.id) || []
        const isCollapsed = effectiveCollapsed.has(project.id)
        
        // Task counts
        const todoCount = projectTasks.filter(t => t.status === 'todo').length
        const inProgressCount = projectTasks.filter(t => t.status === 'in_progress').length
        const blockedCount = projectTasks.filter(t => t.status === 'blocked').length
        const totalActive = todoCount + inProgressCount + blockedCount

        return (
          <div
            key={project.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            {/* Project Lane Header */}
            <button
              onClick={() => handleToggle(project.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {/* Collapse icon */}
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}

              {/* Project color dot */}
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: project.color || '#6b7280' }}
              />

              {/* Project icon + name */}
              <span className="text-lg flex-shrink-0">{project.icon || '📋'}</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 text-left">
                {project.name}
              </span>

              {/* Task counts mini badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {blockedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    🚫 {blockedCount}
                  </span>
                )}
                {inProgressCount > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    🔄 {inProgressCount}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {totalActive} active
                </span>
              </div>
            </button>

            {/* Project Lane Content (collapsible) */}
            {!isCollapsed && (
              <div className="grid grid-cols-3 gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5">
                {columns.map(col => {
                  const columnTasks = projectTasks.filter(t => t.status === col.status)
                  
                  return (
                    <div
                      key={col.status}
                      className="bg-white dark:bg-gray-900 p-2 min-h-[100px]"
                    >
                      {/* Column header (compact) */}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md mb-2",
                        col.bgColor, "dark:bg-opacity-20"
                      )}>
                        <span className="text-sm">{col.icon}</span>
                        <span className={cn("text-xs font-semibold", col.color)}>
                          {col.label}
                        </span>
                        <span className={cn("text-xs font-medium ml-auto", col.color)}>
                          {columnTasks.length}
                        </span>
                      </div>

                      {/* Task cards */}
                      <div className="flex flex-col gap-1.5">
                        {columnTasks.slice(0, 5).map(task => (
                          <CompactTaskCard
                            key={task.id}
                            task={task}
                            onClick={onTaskClick}
                            onStatusChange={onStatusChange}
                          />
                        ))}
                        {columnTasks.length > 5 && (
                          <div className="text-xs text-gray-400 text-center py-1">
                            +{columnTasks.length - 5} more
                          </div>
                        )}
                        {columnTasks.length === 0 && (
                          <div className="text-xs text-gray-300 dark:text-gray-600 text-center py-4 italic">
                            —
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {sortedProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <span className="text-4xl mb-3">📋</span>
          <span className="text-sm">No projects yet</span>
        </div>
      )}
    </div>
  )
}

// ── Compact Task Card ──────────────────────────────────────────

function CompactTaskCard({
  task,
  onClick,
  onStatusChange,
}: {
  task: Task
  onClick?: (task: Task) => void
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void
}) {
  const priorityColors: Record<string, string> = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-blue-500',
    low: 'border-l-gray-300',
  }

  const handleQuickAction = (e: React.MouseEvent, newStatus: TaskStatus) => {
    e.stopPropagation()
    onStatusChange?.(task, newStatus)
  }

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "group px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded border-l-2 cursor-pointer",
        "hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
        priorityColors[task.priority] || 'border-l-gray-300'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
          {task.title}
        </span>

        {/* Quick actions on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === 'todo' && (
            <button
              onClick={(e) => handleQuickAction(e, 'in_progress')}
              className="p-0.5 text-blue-600 hover:bg-blue-100 rounded text-xs"
              title="Start"
            >
              ▶
            </button>
          )}
          {(task.status === 'in_progress' || task.status === 'review') && (
            <button
              onClick={(e) => handleQuickAction(e, 'done')}
              className="p-0.5 text-green-600 hover:bg-green-100 rounded text-xs"
              title="Done"
            >
              ✓
            </button>
          )}
        </div>
      </div>

      {/* Assignee if present */}
      {task.assigned_display_name && (
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">
          → {task.assigned_display_name}
        </div>
      )}
    </div>
  )
}
