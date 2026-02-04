import { useState, useEffect, useCallback } from "react"
import { API_BASE } from "@/lib/api"

export interface Project {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  status: "active" | "paused" | "completed" | "archived"
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

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/projects`)
      if (!response.ok) throw new Error("Failed to fetch projects")
      const data: ProjectsResponse = await response.json()
      setProjects(data.projects || [])
      setError(null)
    } catch (err) {
      console.error("Failed to fetch projects:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Listen for SSE rooms-refresh events (projects share this event)
  useEffect(() => {
    const token = localStorage.getItem("openclaw_token") || ""
    const sseUrl = token
      ? `/api/events?token=${encodeURIComponent(token)}`
      : "/api/events"
    const es = new EventSource(sseUrl)

    es.addEventListener("rooms-refresh", () => {
      fetchProjects()
    })

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
    }
  }, [fetchProjects])

  const createProject = useCallback(
    async (project: {
      name: string
      description?: string
      icon?: string
      color?: string
    }) => {
      try {
        const response = await fetch(`${API_BASE}/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(project),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || "Failed to create project")
        }
        const created: Project = await response.json()
        await fetchProjects()
        return { success: true as const, project: created }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
    [fetchProjects],
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
      },
    ) => {
      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (!response.ok) throw new Error("Failed to update project")
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
    [fetchProjects],
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        const response = await fetch(`${API_BASE}/projects/${projectId}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete project")
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
    [fetchProjects],
  )

  const assignProjectToRoom = useCallback(
    async (roomId: string, projectId: string) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId }),
        })
        if (!response.ok) throw new Error("Failed to assign project to room")
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
    [fetchProjects],
  )

  const clearRoomProject = useCallback(
    async (roomId: string) => {
      try {
        const response = await fetch(`${API_BASE}/rooms/${roomId}/project`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to clear room project")
        await fetchProjects()
        return { success: true as const }
      } catch (err) {
        return {
          success: false as const,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    },
    [fetchProjects],
  )

  const fetchOverview = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/projects/overview`)
      if (!response.ok) throw new Error("Failed to fetch projects overview")
      const data: ProjectsOverviewResponse = await response.json()
      return { success: true as const, projects: data.projects }
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
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
