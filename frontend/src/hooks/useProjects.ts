import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const
const UNKNOWN_ERROR = 'Unknown error'

export interface Project {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  folder_path: string | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  created_at: number
  updated_at: number
  rooms: string[]
}

export interface ProjectOverview extends Project {
  room_count: number
  agent_count: number
}

interface ProjectsResponse {
  projects: Project[]
}

interface ProjectsOverviewResponse {
  projects: ProjectOverview[]
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Data deduplication
  const projectsFingerprintRef = useRef<string>('')

  const fetchProjects = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const response = await fetch(`${API_BASE}/projects`, { signal })
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data: ProjectsResponse = await response.json()
      const newProjects = data.projects || []
      // Deduplicate: only update state if projects actually changed
      const fingerprint = JSON.stringify(
        newProjects.map((p) => `${p.id}:${p.updated_at}:${p.status}`)
      )
      if (fingerprint !== projectsFingerprintRef.current) {
        projectsFingerprintRef.current = fingerprint
        setProjects(newProjects)
      }
      setError(null)
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Failed to fetch projects:', err)
      setError(err instanceof Error ? err.message : UNKNOWN_ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()

    // Cleanup: abort any in-flight requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchProjects])

  // Listen for SSE rooms-refresh events via central manager
  useEffect(() => {
    const handleRoomsRefresh = () => {
      fetchProjects()
    }

    // Subscribe to rooms-refresh events using the central SSE manager
    const unsubscribe = sseManager.subscribe('rooms-refresh', handleRoomsRefresh)

    return () => {
      unsubscribe()
    }
  }, [fetchProjects])

  const createProject = useCallback(
    async (project: {
      name: string
      description?: string
      icon?: string
      color?: string
      folder_path?: string
    }): Promise<{ success: true; project: Project } | { success: false; error: string }> => {
      // Use AbortController for timeout (Vite proxy can sometimes hang)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(`${API_BASE}/projects`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(project),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to create project')
        }

        const created: Project = await response.json()
        await fetchProjects()
        return { success: true as const, project: created }
      } catch (err) {
        clearTimeout(timeoutId)

        // If aborted due to timeout, check if project was actually created
        if (err instanceof Error && err.name === 'AbortError') {
          // Refresh projects and look for the new one
          await fetchProjects()
          // Wait a moment for state to update, then check
          await new Promise((resolve) => setTimeout(resolve, 100))

          // Try to find the project by name in current projects state
          // Note: This is a fallback - the project might be in the refreshed list
          const refreshResponse = await fetch(`${API_BASE}/projects`)
          if (refreshResponse.ok) {
            const data = await refreshResponse.json()
            const found = data.projects?.find((p: Project) => p.name === project.name)
            if (found) {
              return { success: true as const, project: found }
            }
          }
          return {
            success: false as const,
            error: 'Request timed out - please check if project was created',
          }
        }

        return {
          success: false as const,
          error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        }
      }
    },
    [fetchProjects]
  )

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: {
        name?: string
        description?: string
        icon?: string
        color?: string
        status?: string
        folder_path?: string
      }
    ) => {
      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(updates),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to update project')
        }
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        }
      }
    },
    [fetchProjects]
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to delete project')
        }
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        }
      }
    },
    [fetchProjects]
  )

  const assignProjectToRoom = useCallback(
    async (roomId: string, projectId: string) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}/project`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ project_id: projectId }),
        })
        if (!response.ok) throw new Error('Failed to assign project to room')
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        }
      }
    },
    [fetchProjects]
  )

  const clearRoomProject = useCallback(
    async (roomId: string) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}/project`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to clear room project')
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        }
      }
    },
    [fetchProjects]
  )

  const fetchOverview = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/overview`)
      if (!response.ok) throw new Error('Failed to fetch projects overview')
      const data: ProjectsOverviewResponse = await response.json()
      return { success: true as const, projects: data.projects }
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : UNKNOWN_ERROR,
        projects: [] as ProjectOverview[],
      }
    }
  }, [])

  return {
    projects,
    isLoading,
    error,
    refresh: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    assignProjectToRoom,
    clearRoomProject,
    fetchOverview,
  }
}
