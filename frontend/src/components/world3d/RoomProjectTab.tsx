/**
 * RoomProjectTab — Project info, tasks summary, assign/change/clear actions.
 * Extracted from RoomInfoPanel for tab-based layout.
 */
import { useState, useCallback, useMemo } from 'react'
import type { Room } from '@/hooks/useRooms'
import { useProjects } from '@/hooks/useProjects'
import { useTasks, type Task, type TaskStatus } from '@/hooks/useTasks'
import { ProjectPicker } from './ProjectPicker'
import { formatSessionKeyAsName } from '@/lib/friendlyNames'
import type { CrewSession } from '@/lib/api'

interface RoomProjectTabProps {
  room: Room
  sessions: CrewSession[]
  displayNames: Map<string, string | null>
  isActivelyRunning: (key: string) => boolean
  onOpenTaskBoard?: (projectId: string, roomId: string, agents: Array<{ session_key: string; display_name: string }>) => void
  onOpenDocs?: (projectId: string, projectName: string, projectColor?: string) => void  // reserved for future use
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

function getProjectStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'active': return { label: 'Active', color: '#15803d', bg: '#dcfce7' }
    case 'paused': return { label: 'Paused', color: '#a16207', bg: '#fef9c3' }
    case 'completed': return { label: 'Completed', color: '#1d4ed8', bg: '#dbeafe' }
    case 'archived': return { label: 'Archived', color: '#6b7280', bg: '#f3f4f6' }
    default: return { label: status, color: '#6b7280', bg: '#f3f4f6' }
  }
}

export function RoomProjectTab({ room, sessions, displayNames, isActivelyRunning, onOpenTaskBoard, onOpenDocs: _onOpenDocs }: RoomProjectTabProps) {
  const { projects, assignProjectToRoom, clearRoomProject, createProject } = useProjects()
  const [showPicker, setShowPicker] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'change' | 'clear' | null>(null)

  const currentProject = useMemo(() => {
    if (!room.project_id) return null
    return projects.find(p => p.id === room.project_id) ?? null
  }, [room.project_id, projects])

  const activeCount = sessions.filter(s => isActivelyRunning(s.key)).length

  const handleAssignProject = useCallback(async (projectId: string) => {
    await assignProjectToRoom(room.id, projectId)
    setShowPicker(false)
  }, [assignProjectToRoom, room.id])

  const handleClearProject = useCallback(async () => {
    await clearRoomProject(room.id)
    setConfirmAction(null)
  }, [clearRoomProject, room.id])

  const handleChangeClick = useCallback(() => {
    if (activeCount > 0) setConfirmAction('change')
    else setShowPicker(true)
  }, [activeCount])

  const handleClearClick = useCallback(() => {
    if (activeCount > 0) setConfirmAction('clear')
    else handleClearProject()
  }, [activeCount, handleClearProject])

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'change') { setConfirmAction(null); setShowPicker(true) }
    else if (confirmAction === 'clear') handleClearProject()
  }, [confirmAction, handleClearProject])

  if (showPicker) {
    return (
      <ProjectPicker
        projects={projects}
        currentProjectId={room.project_id}
        onSelect={handleAssignProject}
        onCreate={createProject}
        onClose={() => setShowPicker(false)}
      />
    )
  }

  if (confirmAction) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, flex: 1, gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', textAlign: 'center' }}>
          {confirmAction === 'change' ? 'Change room project?' : 'Clear room project?'}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.5, maxWidth: 260 }}>
          This room has <strong>{activeCount}</strong> active agent{activeCount !== 1 ? 's' : ''}.
          {confirmAction === 'change' ? ' Changing the project will update their context.' : ' Clearing the project will remove their project context.'}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={() => setConfirmAction(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'white', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleConfirm} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: confirmAction === 'clear' ? '#ef4444' : '#3b82f6', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {confirmAction === 'change' ? 'Change Project' : 'Clear Project'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', flex: 1 }}>
      {currentProject ? (
        <>
          {/* Project card */}
          <div style={{
            padding: '12px 14px',
            background: (currentProject.color || '#6b7280') + '10',
            borderRadius: 10,
            border: `1px solid ${(currentProject.color || '#6b7280')}20`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: currentProject.color || '#6b7280', flexShrink: 0 }} />
              <span style={{ fontSize: 16, flexShrink: 0 }}>{currentProject.icon || '📋'}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {currentProject.name}
              </span>
            </div>
            {currentProject.description && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                {currentProject.description}
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {(() => { const b = getProjectStatusBadge(currentProject.status); return <span style={{ fontSize: 11, fontWeight: 600, color: b.color, background: b.bg, padding: '2px 8px', borderRadius: 6 }}>{b.label}</span> })()}
            </div>
          </div>

          {/* Tasks section */}
          <TasksSummary
            projectId={currentProject.id}
            roomId={room.id}
            agents={sessions.map(s => ({ session_key: s.key, display_name: displayNames.get(s.key) || formatSessionKeyAsName(s.key, s.label) }))}
            onOpenFullBoard={onOpenTaskBoard}
          />

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleChangeClick} style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'white', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Change Project
            </button>
            <button onClick={handleClearClick} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', background: 'white', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
            {room.is_hq ? '🏛️ Command Center' : 'General Room'}
          </span>
          <button onClick={() => setShowPicker(true)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.05)', color: '#3b82f6', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Assign Project
          </button>
        </div>
      )}
    </div>
  )
}

// Tasks summary sub-component
function TasksSummary({ projectId, roomId, agents, onOpenFullBoard }: {
  projectId: string
  roomId: string
  agents: Array<{ session_key: string; display_name: string }>
  onOpenFullBoard?: (projectId: string, roomId: string, agents: Array<{ session_key: string; display_name: string }>) => void
}) {
  const { tasks, taskCounts, updateTask } = useTasks({ projectId, roomId })
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 5)

  const handleStatusChange = useCallback(async (task: Task, newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus })
  }, [updateTask])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📋 Tasks
        </div>
        <button onClick={() => onOpenFullBoard?.(projectId, roomId, agents)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          View Board →
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {([['todo', 'To Do', '#6b7280'], ['in_progress', 'In Progress', '#2563eb'], ['blocked', 'Blocked', '#dc2626'], ['done', 'Done', '#15803d']] as const).map(([key, label, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: color + '10', borderRadius: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{taskCounts[key]}</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
          </div>
        ))}
      </div>
      {activeTasks.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeTasks.map(task => {
            const priorityColors: Record<string, string> = { urgent: '#dc2626', high: '#ea580c', medium: '#2563eb', low: '#6b7280' }
            const statusColors: Record<string, string> = { todo: '#6b7280', in_progress: '#2563eb', review: '#7c3aed', blocked: '#dc2626' }
            return (
              <div key={task.id} style={{ padding: '8px 10px', background: '#fff', borderRadius: 6, borderLeft: `3px solid ${priorityColors[task.priority]}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[task.status], flexShrink: 0 }} />
                {task.status === 'todo' && (
                  <button onClick={() => handleStatusChange(task, 'in_progress')} title="Start" style={{ padding: '2px 6px', fontSize: 10, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}>▶</button>
                )}
                {(task.status === 'in_progress' || task.status === 'review') && (
                  <button onClick={() => handleStatusChange(task, 'done')} title="Done" style={{ padding: '2px 6px', fontSize: 10, background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✓</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
