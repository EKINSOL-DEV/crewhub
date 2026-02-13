import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { StandupModal, StandupHistory } from '@/components/standups'
import type { CrewSession } from '@/lib/api'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useProjects, type ProjectOverview } from '@/hooks/useProjects'
// useTasks moved to RoomProjectTab
import { useToast } from '@/hooks/use-toast'
// ProjectPicker moved to RoomProjectTab
import { EditRoomDialog } from '@/components/shared/EditRoomDialog'
import { formatSessionKeyAsName } from '@/lib/friendlyNames'
// ProjectFilesSection used in RoomFilesTab
import { RoomInfoTab } from './RoomInfoTab'
import { RoomProjectTab } from './RoomProjectTab'
import { RoomFilesTab } from './RoomFilesTab'
import { OrgChartTab } from './OrgChartTab'

// ── Types ──────────────────────────────────────────────────────

type BotStatus = 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline'

interface RoomInfoPanelProps {
  room: Room
  sessions: CrewSession[]
  isActivelyRunning: (key: string) => boolean
  displayNames: Map<string, string | null>
  onClose: () => void
  onBotClick?: (session: CrewSession) => void
  onFocusRoom?: (roomId: string) => void
  onOpenTaskBoard?: (projectId: string, roomId: string, agents: Array<{ session_key: string; display_name: string }>) => void
  onOpenHQBoard?: () => void
  onOpenContext?: (roomId: string, roomName: string) => void
}

// ── Helpers ────────────────────────────────────────────────────

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

// getStatusBadge, formatModel, getDisplayName moved to RoomInfoTab.tsx

function getDisplayName(session: CrewSession, aliasName: string | null | undefined): string {
  // Priority: custom alias > session label > display name > formatted session key
  if (aliasName) return aliasName
  if (session.label) return session.label
  if (session.displayName && !session.displayName.includes(':')) return session.displayName
  
  // Use the centralized formatting function
  return formatSessionKeyAsName(session.key, session.label)
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
  onOpenTaskBoard,
  onOpenHQBoard,
  onOpenContext,
}: RoomInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const roomColor = room.color || '#4f46e5'

  // Rooms hook (for updating)
  const { updateRoom } = useRooms()
  const { toast } = useToast()

  // Projects hook
  const {
    projects,
    fetchOverview,
  } = useProjects()

  // UI state
  const [activeInfoTab, setActiveInfoTab] = useState<'room' | 'project' | 'files' | 'org'>('room')
  const [showEditDialog, setShowEditDialog] = useState(false)
  // Note: showPicker/confirmAction moved to RoomProjectTab, but we keep references for outside-click guard
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

  // Close on outside click (but not when a dialog/picker is open)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't close panel when Edit Room dialog, Project Picker, or confirmation dialog is open
      if (showEditDialog) return

      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Also check if click is inside any Radix dialog overlay/content (role="dialog")
        const target = e.target as HTMLElement
        if (target.closest?.('[role="dialog"]') || target.closest?.('[data-radix-dialog-overlay]')) return

        // Don't close when clicking inside fullscreen overlay (portaled to document.body)
        if (target.closest?.('[data-fullscreen-overlay]')) return

        // Don't close when clicking on the 3D canvas (camera rotation/pan starts with mousedown)
        // or on 3D world UI overlays (e.g. Focus Board button rendered via drei Html)
        if (target.closest?.('canvas') || target.tagName === 'CANVAS') return
        if (target.closest?.('[data-world-ui]')) return

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
  }, [onClose, showEditDialog])

  // Compute bot statuses
  const botData = useMemo(() => {
    return sessions.map(s => {
      const isActive = isActivelyRunning(s.key)
      const status = getAccurateBotStatus(s, isActive)
      const name = getDisplayName(s, displayNames.get(s.key))
      return { session: s, status, name }
    }).sort((a, b) => {
      const order: Record<BotStatus, number> = { active: 0, supervising: 1, idle: 2, sleeping: 3, offline: 4 }
      return order[a.status] - order[b.status]
    })
  }, [sessions, isActivelyRunning, displayNames])

  const statuses = botData.map(b => b.status)
  const activityStatus = getRoomActivityStatus(statuses)

  // Handlers
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
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 360,
        zIndex: 25,
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
            onClick={() => onOpenContext?.(room.id, room.name)}
            title="Context Inspector"
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
            🔍
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

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '0 16px',
        marginTop: 16,
        gap: 0,
        flexShrink: 0,
      }}>
        {([
          { id: 'room' as const, label: '🏠 Room', always: true },
          { id: 'project' as const, label: room.is_hq ? '🏛️ HQ' : '📋 Project', always: true },
          { id: 'files' as const, label: '📂 Files', always: !!(currentProject?.folder_path) },
          { id: 'org' as const, label: '🏢 Org Chart', always: !!room.is_hq },
        ]).filter(t => t.always).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveInfoTab(tab.id)}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: activeInfoTab === tab.id ? '#374151' : '#9ca3af',
              borderBottom: `2px solid ${activeInfoTab === tab.id ? '#3b82f6' : 'transparent'}`,
              background: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              borderBottomColor: activeInfoTab === tab.id ? '#3b82f6' : 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeInfoTab === 'room' && (
          <RoomInfoTab
            sessions={sessions}
            isActivelyRunning={isActivelyRunning}
            displayNames={displayNames}
            onBotClick={onBotClick}
          />
        )}
        {activeInfoTab === 'project' && (
          room.is_hq ? (
            <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
              <HQDashboard
                overview={hqOverview}
                loading={hqLoading}
                onProjectClick={onFocusRoom}
                onOpenHQBoard={onOpenHQBoard}
              />
            </div>
          ) : (
            <RoomProjectTab
              room={room}
              sessions={sessions}
              displayNames={displayNames}
              isActivelyRunning={isActivelyRunning}
              onOpenTaskBoard={onOpenTaskBoard}
            />
          )
        )}
        {activeInfoTab === 'files' && (
          <RoomFilesTab
            room={room}
          />
        )}
        {activeInfoTab === 'org' && (
          <OrgChartTab />
        )}
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

// TasksSection, TaskCountBadge, MiniTaskCard moved to RoomProjectTab.tsx

// ── HQ Dashboard ───────────────────────────────────────────────

function HQDashboard({
  overview,
  loading,
  onProjectClick,
  onOpenHQBoard,
}: {
  overview: ProjectOverview[]
  loading: boolean
  onProjectClick?: (roomId: string) => void
  onOpenHQBoard?: () => void
}) {
  const [standupOpen, setStandupOpen] = useState(false)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader>🏛️ COMMAND CENTER</SectionHeader>
        {onOpenHQBoard && (
          <button
            onClick={onOpenHQBoard}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 4px rgba(245,158,11,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(245,158,11,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(245,158,11,0.3)'
            }}
          >
            📋 HQ Board
          </button>
        )}
        <button
          onClick={() => setStandupOpen(true)}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 4px rgba(79,70,229,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(79,70,229,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(79,70,229,0.3)'
          }}
        >
          🗓️ Daily Standup
        </button>
      </div>

      {/* Standup Modal */}
      <StandupModal open={standupOpen} onClose={() => setStandupOpen(false)} />
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

      {/* Recent Standups */}
      <div style={{ marginTop: 20 }}>
        <SectionHeader>🗓️ RECENT STANDUPS</SectionHeader>
        <div style={{ marginTop: 8 }}>
          <StandupHistory maxDays={3} />
        </div>
      </div>
    </div>
  )
}

// ConfirmDialog moved to RoomProjectTab.tsx

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
