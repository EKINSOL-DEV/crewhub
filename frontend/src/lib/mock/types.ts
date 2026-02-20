/**
 * Mock API — shared types
 */

export interface MockRoom {
  id: string
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  floor_style: string
  wall_style: string
  project_id: string | null
  project_name: string | null
  project_color: string | null
  is_hq: boolean
  created_at: number
  updated_at: number
}

export interface MockAgent {
  id: string
  name: string
  icon: string | null
  avatar_url: string | null
  color: string | null
  agent_session_key: string | null
  default_model: string | null
  default_room_id: string | null
  sort_order: number
  is_pinned: boolean
  auto_spawn: boolean
  bio: string | null
  created_at: number
  updated_at: number
}

export interface MockProject {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  folder_path: string | null
  status: string
  created_at: number
  updated_at: number
  rooms: string[]
}

export interface MockTask {
  id: string
  project_id: string
  room_id: string | null
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_session_key: string | null
  assigned_display_name: string | null
  created_by: string | null
  created_at: number
  updated_at: number
}
