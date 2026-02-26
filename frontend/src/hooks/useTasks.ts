import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

// ── Types ──────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  project_id: string
  room_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigned_session_key: string | null
  assigned_display_name: string | null
  created_by: string | null
  created_at: number
  updated_at: number
}

export interface TaskCreate {
  project_id: string
  room_id?: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigned_session_key?: string
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  room_id?: string
  assigned_session_key?: string
}

interface TasksResponse {
  tasks: Task[]
  total: number
}

// ── Hook ───────────────────────────────────────────────────────

interface UseTasksOptions {
  projectId?: string
  roomId?: string
  status?: string // comma-separated list
  autoFetch?: boolean
}

export function useTasks(options: UseTasksOptions = {}) {
  const { projectId, roomId, status, autoFetch = true } = options

  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const tasksFingerprintRef = useRef<string>('')

  const fetchTasks = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const params = new URLSearchParams()
      if (projectId) params.set('project_id', projectId)
      if (roomId) params.set('room_id', roomId)
      if (status) params.set('status', status)

      const url = `${API_BASE}/tasks${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url, { signal })

      if (!response.ok) throw new Error('Failed to fetch tasks')

      const data: TasksResponse = await response.json()
      const newTasks = data.tasks || []

      // Deduplicate: only update state if tasks actually changed
      const fingerprint = JSON.stringify(newTasks.map((t) => `${t.id}:${t.updated_at}:${t.status}`))
      if (fingerprint !== tasksFingerprintRef.current) {
        tasksFingerprintRef.current = fingerprint
        setTasks(newTasks)
        setTotal(data.total)
      }
      setError(null)
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to fetch tasks:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, roomId, status])

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchTasks()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchTasks, autoFetch])

  // Listen for SSE task events
  useEffect(() => {
    const handleTaskCreated = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { project_id?: string; room_id?: string }
        // Refresh if this task belongs to our filtered project/room
        if (
          (projectId && data.project_id === projectId) ||
          (roomId && data.room_id === roomId) ||
          (!projectId && !roomId)
        ) {
          fetchTasks()
        }
      } catch {
        fetchTasks() // Fallback: always refresh on error
      }
    }

    const handleTaskUpdated = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { project_id?: string; room_id?: string }
        if (
          (projectId && data.project_id === projectId) ||
          (roomId && data.room_id === roomId) ||
          (!projectId && !roomId)
        ) {
          fetchTasks()
        }
      } catch {
        fetchTasks()
      }
    }

    const handleTaskDeleted = () => {
      fetchTasks()
    }

    const unsub1 = sseManager.subscribe('task-created', handleTaskCreated)
    const unsub2 = sseManager.subscribe('task-updated', handleTaskUpdated)
    const unsub3 = sseManager.subscribe('task-deleted', handleTaskDeleted)

    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [fetchTasks, projectId, roomId])

  // ── CRUD Operations ──────────────────────────────────────────

  const createTask = useCallback(
    async (
      task: TaskCreate
    ): Promise<{ success: true; task: Task } | { success: false; error: string }> => {
      try {
        const response = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to create task')
        }

        const created: Task = await response.json()
        return { success: true, task: created }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    []
  )

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: TaskUpdate
    ): Promise<{ success: true; task: Task } | { success: false; error: string }> => {
      try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to update task')
        }

        const updated: Task = await response.json()
        return { success: true, task: updated }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    []
  )

  const deleteTask = useCallback(
    async (taskId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to delete task')
        }

        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    []
  )

  // ── Helper: Get tasks by status ──────────────────────────────

  const getTasksByStatus = useCallback(
    (targetStatus: TaskStatus): Task[] => {
      return tasks.filter((t) => t.status === targetStatus)
    },
    [tasks]
  )

  const taskCounts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  }

  return {
    tasks,
    total,
    isLoading,
    error,
    refresh: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    getTasksByStatus,
    taskCounts,
  }
}
