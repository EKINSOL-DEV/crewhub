/**
 * RoomFilesTab — Project files browser tab for RoomInfoPanel.
 * Wraps ProjectFilesSection with the room panel context.
 */
import { useMemo } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { ProjectFilesSection } from '../files/ProjectFilesSection'
import type { Room } from '@/hooks/useRooms'

interface RoomFilesTabProps {
  readonly room: Room
}

export function RoomFilesTab({ room }: RoomFilesTabProps) {
  const { projects } = useProjects()

  const currentProject = useMemo(() => {
    if (!room.project_id) return null
    return projects.find((p) => p.id === room.project_id) ?? null
  }, [room.project_id, projects])

  if (!currentProject) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
          fontSize: 13,
          gap: 8,
          padding: 24,
        }}
      >
        <span style={{ fontSize: 32 }}>📂</span>
        <span>No project assigned</span>
      </div>
    )
  }

  if (!currentProject.folder_path) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
          fontSize: 13,
          gap: 8,
          padding: 24,
        }}
      >
        <span style={{ fontSize: 32 }}>📂</span>
        <span>No folder configured for this project</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1 }}>
      <ProjectFilesSection
        projectId={currentProject.id}
        projectName={currentProject.name}
        projectColor={currentProject.color || undefined}
      />
    </div>
  )
}
