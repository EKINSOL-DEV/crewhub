import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import type { CrewSession } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useProjects, type ProjectOverview } from '@/hooks/useProjects'
import { useToast } from '@/hooks/use-toast'
import { ProjectPicker } from './ProjectPicker'
import { EditRoomDialog } from '@/components/shared/EditRoomDialog'

// ── Types ──────────────────────────────────────────────────────

type BotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

interface RoomInfoPanelProps {
  room: Room
  sessions: CrewSession[]
  isActivelyRunning: (key: string) => boolean
  displayNames: Map<string, string | null>
  onClose: () => void
  onBotClick?: (session: CrewSession) => void
  onFocusRoom?: (roomId: string) => void
  onOpenDocs?: (projectId: string, projectName: string, projectColor?: string) => void
}

// ── Helpers ────────────────────────────────────────────────────

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

function getStatusBadge(status: BotStatus): { label: string; color: string; bg: string; dot: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', bg: '#dcfce7', dot: '#22c55e' }
    case 'idle':
      return { label: 'Idle', color: '#a16207', bg: '#fef9c3', dot: '#eab308' }
    case 'sleeping':
      return { label: 'Sleeping', color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' }
    case 'offline':
      return { label: 'Offline', color: '#991b1b', bg: '#fecaca', dot: '#ef4444' }
  }
}

function formatModel(model?: string): string {
  if (!model) return '—'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gpt-5')) return 'GPT-5'
  const parts = model.split('/')
  return parts[parts.length - 1].slice(0, 16)
}

function getDisplayName(session: CrewSession, aliasName: string | null | undefined): string {
  if (aliasName) return aliasName
  if (session.displayName) return session.displayName
  const parts = session.key.split(':')
  if (parts.length >= 2) {
    const name = parts[1]
    return name.charAt(0).toUpperCase() + name.slice(1)
  }
  return session.key
}

function getRoomActivityStatus(statuses: BotStatus[]): { label: string; color: string } {
  const activeCount = statuses.filter(s => s === 'active').length
  if (activeCount > 0) return { label: `${activeCount} agent${activeCount > 1 ? 's' : ''} working`, color: '#15803d' }
  const idleCount = statuses.filter(s => s === 'idle').length
  if (idleCount > 0) return { label: 'Idle', color: '#a16207' }
  if (statuses.length > 0) return { label: 'All sleeping', color: '#6b7280' }
  return { label: 'Empty', color: '#9ca3af' }
}

function getProjectStatusBadge(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'active': return { label: 'Active', color: '#15803d', bg: '#dcfce7' }
    case 'paused': return { label: 'Paused', color: '#a16207', bg: '#fef9c3' }
    case 'completed': return { label: 'Completed', color: '#1d4ed8', bg: '#dbeafe' }
    case 'archived': return { label: 'Archived', color: '#6b7280', bg: '#f3f4f6' }
    default: return { label: status, color: '#6b7280', bg: '#f3f4f6' }
  }
}

// ── Component ──────────────────────────────────────────────────

export function RoomInfoPanel({
  room,
  sessions,
  isActivelyRunning,
  displayNames,
  onClose,
  onBotClick,
  onFocusRoom,
  onOpenDocs,
}: RoomInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const roomColor = room.color || '#4f46e5'

  // Rooms hook (for updating)
  const { updateRoom } = useRooms()
  const { toast } = useToast()

  // Projects hook
  const {
    projects,
    assignProjectToRoom,
    clearRoomProject,
    createProject,
    fetchOverview,
  } = useProjects()

  // UI state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'change' | 'clear' | null>(null)
  const [hqOverview, setHqOverview] = useState<ProjectOverview[]>([])
  const [hqLoading, setHqLoading] = useState(false)

  // Current project from room data
  const currentProject = useMemo(() => {
    if (!room.project_id) return null
    return projects.find(p => p.id === room.project_id) ?? null
  }, [room.project_id, projects])

  // Fetch HQ overview when room is HQ
  useEffect(() => {
    if (room.is_hq) {
      setHqLoading(true)
      fetchOverview().then(result => {
        if (result.success) {
          setHqOverview(result.projects)
        }
        setHqLoading(false)
      })
    }
  }, [room.is_hq, fetchOverview])

  // Close on outside click (but not when clicking inside a portaled dialog)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Radix Dialog portals its content outside the panel DOM tree.
        // Don't close the panel when the user clicks inside a dialog.
        const target = e.target as HTMLElement
        if (target.closest?.('[data-radix-portal]')) return

        setTimeout(() => onClose(), 50)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 200)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Compute bot statuses
  const botData = useMemo(() => {
    return sessions.map(s => {
      const isActive = isActivelyRunning(s.key)
      const status = getAccurateBotStatus(s, isActive)
      const name = getDisplayName(s, displayNames.get(s.key))
      return { session: s, status, name }
    }).sort((a, b) => {
      const order: Record<BotStatus, number> = { active: 0, idle: 1, sleeping: 2, offline: 3 }
      return order[a.status] - order[b.status]
    })
  }, [sessions, isActivelyRunning, displayNames])

  const statuses = botData.map(b => b.status)
  const activeCount = statuses.filter(s => s === 'active').length
  const idleCount = statuses.filter(s => s === 'idle').length
  const sleepingCount = statuses.filter(s => s === 'sleeping' || s === 'offline').length
  const activityStatus = getRoomActivityStatus(statuses)

  // Handlers
  const handleAssignProject = useCallback(async (projectId: string) => {
    await assignProjectToRoom(room.id, projectId)
    setShowPicker(false)
  }, [assignProjectToRoom, room.id])

  const handleClearProject = useCallback(async () => {
    await clearRoomProject(room.id)
    setConfirmAction(null)
  }, [clearRoomProject, room.id])

  const handleChangeClick = useCallback(() => {
    if (activeCount > 0) {
      setConfirmAction('change')
    } else {
      setShowPicker(true)
    }
  }, [activeCount])

  const handleClearClick = useCallback(() => {
    if (activeCount > 0) {
      setConfirmAction('clear')
    } else {
      handleClearProject()
    }
  }, [activeCount, handleClearProject])

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'change') {
      setConfirmAction(null)
      setShowPicker(true)
    } else if (confirmAction === 'clear') {
      handleClearProject()
    }
  }, [confirmAction, handleClearProject])

  const handleEditRoomSave = useCallback(async (roomId: string, updates: {
    name?: string; icon?: string; color?: string; floor_style?: string; wall_style?: string
  }) => {
    const result = await updateRoom(roomId, updates)
    if (result.success) {
      toast({ title: 'Room Updated!', description: `${updates.icon || room.icon} ${updates.name || room.name} saved` })
    } else {
      toast({ title: 'Failed to update room', description: result.error, variant: 'destructive' })
    }
    return result
  }, [updateRoom, toast, room.icon, room.name])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 360,
        zIndex: 60,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'roomPanelSlideIn 0.3s ease-out',
      }}
    >
      {/* Edit Room Dialog */}
      <EditRoomDialog
        room={room}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleEditRoomSave}
      />

      {/* Project Picker overlay */}
      {showPicker && (
        <ProjectPicker
          projects={projects}
          currentProjectId={room.project_id}
          onSelect={handleAssignProject}
          onCreate={createProject}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Confirmation Dialog overlay */}
      {confirmAction && (
        <ConfirmDialog
          activeCount={activeCount}
          action={confirmAction}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        {/* Room icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: roomColor + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
        }}>
          {room.icon || '🏠'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {room.name}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: activityStatus.color,
              background: activityStatus.color + '15',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: activityStatus.color,
                display: 'inline-block',
              }} />
              {activityStatus.label}
            </span>
          </div>
        </div>

        {/* Edit & Close buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setShowEditDialog(true)}
            title="Edit Room"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'rgba(0, 0, 0, 0.05)',
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
          >
            ✏️
          </button>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'rgba(0, 0, 0, 0.05)',
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Separator */}
      <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', margin: '16px 0 0' }} />

      {/* Info Body */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Project Section */}
        <div>
          <SectionHeader>📋 Project</SectionHeader>
          {currentProject ? (
            /* Has project assigned */
            <div style={{ marginTop: 8 }}>
              <div style={{
                padding: '12px 14px',
                background: (currentProject.color || '#6b7280') + '10',
                borderRadius: 10,
                border: `1px solid ${(currentProject.color || '#6b7280')}20`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: currentProject.color || '#6b7280',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 16, flexShrink: 0 }}>
                    {currentProject.icon || '📋'}
                  </span>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1f2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {currentProject.name}
                  </span>
                </div>

                {currentProject.description && (
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    marginTop: 6,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}>
                    {currentProject.description}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const badge = getProjectStatusBadge(currentProject.status)
                    return (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Browse Docs button (only when folder_path is set) */}
              {currentProject?.folder_path ? (
                <button
                  onClick={() => onOpenDocs?.(currentProject.id, currentProject.name, currentProject.color || undefined)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '10px 16px',
                    marginTop: 8,
                    borderRadius: 8,
                    border: 'none',
                    background: (currentProject.color || roomColor) + '15',
                    color: currentProject.color || roomColor,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = (currentProject.color || roomColor) + '25' }}
                  onMouseLeave={e => { e.currentTarget.style.background = (currentProject.color || roomColor) + '15' }}
                >
                  📂 Browse Project Docs
                </button>
              ) : (
                <div style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.03)',
                  fontSize: 11,
                  color: '#9ca3af',
                  textAlign: 'center',
                }}>
                  No folder configured — docs browser unavailable
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleChangeClick}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'white',
                    color: '#374151',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
                >
                  Change Project
                </button>
                <button
                  onClick={handleClearClick}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.2)',
                    background: 'white',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            /* No project — General Room */
            <div style={{ marginTop: 8 }}>
              <div style={{
                padding: '12px 14px',
                background: 'rgba(0, 0, 0, 0.03)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>
                  {room.is_hq ? '🏛️ Command Center' : 'General Room'}
                </span>
                <button
                  onClick={() => setShowPicker(true)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(59,130,246,0.3)',
                    background: 'rgba(59,130,246,0.05)',
                    color: '#3b82f6',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.05)' }}
                >
                  Assign Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* HQ Command Center — All Projects Dashboard */}
        {room.is_hq && (
          <HQDashboard
            overview={hqOverview}
            loading={hqLoading}
            onProjectClick={onFocusRoom}
          />
        )}

        {/* Room Stats */}
        <div>
          <SectionHeader>📊 Room Stats</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <InfoRow label="Total Agents">{sessions.length}</InfoRow>
            <InfoRow label="Active">
              <span style={{ color: '#15803d', fontWeight: 600 }}>{activeCount}</span>
            </InfoRow>
            <InfoRow label="Idle">
              <span style={{ color: '#a16207', fontWeight: 600 }}>{idleCount}</span>
            </InfoRow>
            <InfoRow label="Sleeping">
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{sleepingCount}</span>
            </InfoRow>
          </div>
        </div>

        {/* Agent List */}
        <div>
          <SectionHeader>🤖 Agents in Room</SectionHeader>
          {botData.length === 0 ? (
            <div style={{
              marginTop: 8,
              padding: '12px 14px',
              background: 'rgba(0, 0, 0, 0.03)',
              borderRadius: 10,
              fontSize: 13,
              color: '#9ca3af',
              textAlign: 'center',
            }}>
              No agents in this room
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {botData.map(({ session, status, name }) => {
                const badge = getStatusBadge(status)
                return (
                  <button
                    key={session.key}
                    onClick={() => onBotClick?.(session)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(0, 0, 0, 0.02)',
                      cursor: onBotClick ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                      width: '100%',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)' }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: badge.dot,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#9ca3af',
                      minWidth: 45,
                      textAlign: 'right',
                    }}>
                      {formatModel(session.model)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes roomPanelSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── HQ Dashboard ───────────────────────────────────────────────

function HQDashboard({
  overview,
  loading,
  onProjectClick,
}: {
  overview: ProjectOverview[]
  loading: boolean
  onProjectClick?: (roomId: string) => void
}) {
  return (
    <div>
      <SectionHeader>🏛️ COMMAND CENTER</SectionHeader>
      {loading ? (
        <div style={{
          marginTop: 8,
          padding: '16px 14px',
          background: 'rgba(245,158,11,0.05)',
          borderRadius: 10,
          fontSize: 13,
          color: '#9ca3af',
          textAlign: 'center',
        }}>
          Loading projects…
        </div>
      ) : overview.length === 0 ? (
        <div style={{
          marginTop: 8,
          padding: '16px 14px',
          background: 'rgba(245,158,11,0.05)',
          borderRadius: 10,
          fontSize: 13,
          color: '#9ca3af',
          textAlign: 'center',
        }}>
          No projects yet
        </div>
      ) : (
        <div style={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {overview.map(project => {
            const statusBadge = getProjectStatusBadge(project.status)
            // Find the first room assigned to this project for navigation
            const primaryRoomId = project.rooms?.[0]
            const clickable = !!primaryRoomId && !!onProjectClick

            return (
              <button
                key={project.id}
                onClick={() => {
                  if (clickable) onProjectClick!(primaryRoomId)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(245,158,11,0.12)',
                  background: 'rgba(245,158,11,0.04)',
                  cursor: clickable ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'rgba(245,158,11,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.04)' }}
              >
                {/* Color dot */}
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: project.color || '#6b7280',
                  flexShrink: 0,
                }} />

                {/* Icon + info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{project.icon || '📋'}</span>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1f2937',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {project.name}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#9ca3af',
                    marginTop: 2,
                  }}>
                    {project.room_count} room{project.room_count !== 1 ? 's' : ''} · {project.agent_count} agent{project.agent_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Status */}
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: statusBadge.color,
                  background: statusBadge.bg,
                  padding: '2px 6px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  {statusBadge.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Confirmation Dialog ────────────────────────────────────────

function ConfirmDialog({
  activeCount,
  action,
  onConfirm,
  onCancel,
}: {
  activeCount: number
  action: 'change' | 'clear'
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      zIndex: 70,
      animation: 'pickerFadeIn 0.15s ease-out',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{
        fontSize: 15,
        fontWeight: 700,
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        {action === 'change' ? 'Change room project?' : 'Clear room project?'}
      </div>
      <div style={{
        fontSize: 13,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 1.5,
        marginBottom: 20,
        maxWidth: 260,
      }}>
        This room has <strong>{activeCount}</strong> active agent{activeCount !== 1 ? 's' : ''}.
        {action === 'change'
          ? ' Changing the project will update their context.'
          : ' Clearing the project will remove their project context.'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.1)',
            background: 'white',
            color: '#6b7280',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: action === 'clear' ? '#ef4444' : '#3b82f6',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {action === 'change' ? 'Change Project' : 'Clear Project'}
        </button>
      </div>

      <style>{`
        @keyframes pickerFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Reusable components ────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#6b7280',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        color: '#374151',
        fontWeight: 600,
      }}>
        {children}
      </span>
    </div>
  )
}
