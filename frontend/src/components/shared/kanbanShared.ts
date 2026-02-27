import type { Task, TaskStatus } from '@/hooks/useTasks'
import { PRIORITY_CONFIG } from '@/lib/taskConstants'

export interface KanbanColumnConfig {
  status: TaskStatus
  label: string
  icon: string
  color: string
}

const BASE_COLUMNS: Array<Pick<KanbanColumnConfig, 'status' | 'label' | 'icon'>> = [
  { status: 'todo', label: 'To Do', icon: '📋' },
  { status: 'in_progress', label: 'In Progress', icon: '🔄' },
  { status: 'review', label: 'Review', icon: '👀' },
  { status: 'blocked', label: 'Blocked', icon: '⚠️' },
  { status: 'done', label: 'Done', icon: '✅' },
]

export function buildKanbanColumns(colors: Record<TaskStatus, string>): KanbanColumnConfig[] {
  return BASE_COLUMNS.map((column) => ({
    ...column,
    color: colors[column.status],
  }))
}

export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
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

  for (const status of Object.keys(grouped) as TaskStatus[]) {
    grouped[status].sort((a, b) => {
      const priorityDiff = PRIORITY_CONFIG[a.priority].weight - PRIORITY_CONFIG[b.priority].weight
      if (priorityDiff !== 0) return priorityDiff
      return b.updated_at - a.updated_at
    })
  }

  return grouped
}
