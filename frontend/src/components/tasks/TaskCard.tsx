import { memo, useState, useRef, useEffect } from 'react'
import type { Task, TaskStatus, TaskPriority } from '@/hooks/useTasks'
import { SpawnAgentDialog } from './SpawnAgentDialog'

// ── Priority Colors ────────────────────────────────────────────

const priorityConfig: Record<TaskPriority, { color: string; bg: string; label: string }> = {
  urgent: { color: '#dc2626', bg: '#fef2f2', label: 'Urgent' },
  high: { color: '#ea580c', bg: '#fff7ed', label: 'High' },
  medium: { color: '#2563eb', bg: '#eff6ff', label: 'Medium' },
  low: { color: '#6b7280', bg: '#f9fafb', label: 'Low' },
}

// ── Status Colors ──────────────────────────────────────────────

const statusConfig: Record<TaskStatus, { color: string; bg: string; label: string }> = {
  todo: { color: '#6b7280', bg: '#f3f4f6', label: 'To Do' },
  in_progress: { color: '#2563eb', bg: '#dbeafe', label: 'In Progress' },
  review: { color: '#7c3aed', bg: '#ede9fe', label: 'Review' },
  done: { color: '#15803d', bg: '#dcfce7', label: 'Done' },
  blocked: { color: '#dc2626', bg: '#fef2f2', label: 'Blocked' },
}

// ── Props ──────────────────────────────────────────────────────

interface TaskCardProps {
  readonly task: Task
  readonly compact?: boolean
  readonly showStatus?: boolean
  readonly hideRunWithAgent?: boolean
  readonly onClick?: (task: Task) => void
  readonly onStatusChange?: (task: Task, newStatus: TaskStatus) => void
  readonly onSpawnAgent?: (task: Task, agentId: string, sessionKey: string) => void
}

// ── Component ──────────────────────────────────────────────────

export const TaskCard = memo(function TaskCard({
  task,
  compact = false,
  showStatus = false,
  hideRunWithAgent = false,
  onClick,
  onStatusChange,
  onSpawnAgent,
}: TaskCardProps) {
  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState(false)
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const handleClick = () => {
    onClick?.(task)
  }

  const handleSpawn = (agentId: string, sessionKey: string) => {
    onSpawnAgent?.(task, agentId, sessionKey)
  }

  // Quick status change buttons
  const canMoveToDone = task.status === 'in_progress' || task.status === 'review'
  const canMoveToBlocked = task.status === 'in_progress'

  // Show Run with Agent button for todo/blocked tasks (not already in progress or done)
  const showRunWithAgentButton =
    !hideRunWithAgent && (task.status === 'todo' || task.status === 'blocked')

  return (
    <>
      <div
        {...(onClick
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: handleClick,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick()
                }
              },
            }
          : {})}
        style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: compact ? '8px 10px' : '12px 14px',
          borderLeft: `3px solid ${priority.color}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'box-shadow 0.15s, transform 0.15s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Header: Title + Priority Badge + Dropdown */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span
            style={{
              flex: 1,
              fontSize: compact ? 13 : 14,
              fontWeight: 500,
              color: '#1f2937',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.title}
          </span>

          {/* Priority Badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: priority.color,
              background: priority.bg,
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            {task.priority === 'medium' ? 'MED' : task.priority.slice(0, 3).toUpperCase()}
          </span>

          {/* Dropdown Menu Button */}
          <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
              style={{
                background: showDropdown ? '#f3f4f6' : 'transparent',
                border: 'none',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: 'pointer',
                fontSize: 14,
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
              }}
              title="More actions"
            >
              ⋮
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  border: '1px solid #e5e7eb',
                  minWidth: 160,
                  zIndex: 10,
                  overflow: 'hidden',
                }}
              >
                {/* Status change options */}
                {canMoveToDone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(false)
                      onStatusChange?.(task, 'done')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    ✅ Mark as Done
                  </button>
                )}

                {canMoveToBlocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(false)
                      onStatusChange?.(task, 'blocked')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    ⚠️ Mark as Blocked
                  </button>
                )}

                {(canMoveToDone || canMoveToBlocked) && (
                  <div style={{ borderTop: '1px solid #e5e7eb' }} />
                )}

                {/* Move to other status options */}
                {task.status !== 'todo' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(false)
                      onStatusChange?.(task, 'todo')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    📋 Move to To Do
                  </button>
                )}

                {task.status !== 'in_progress' && task.status !== 'done' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(false)
                      onStatusChange?.(task, 'in_progress')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    🔄 Move to In Progress
                  </button>
                )}

                {task.status !== 'review' && task.status !== 'done' && task.status !== 'todo' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(false)
                      onStatusChange?.(task, 'review')
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    👀 Move to Review
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description (if not compact and exists) */}
        {!compact && task.description && (
          <p
            style={{
              fontSize: 12,
              color: '#6b7280',
              marginTop: 6,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.description}
          </p>
        )}

        {/* Run with Agent Button - Direct on card */}
        {showRunWithAgentButton && !compact && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSpawnDialogOpen(true)
            }}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #dbeafe',
              background: '#eff6ff',
              color: '#2563eb',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dbeafe'
              e.currentTarget.style.borderColor = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#eff6ff'
              e.currentTarget.style.borderColor = '#dbeafe'
            }}
          >
            🚀 Run with Agent
          </button>
        )}

        {/* Footer: Assignee + Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: compact ? 6 : 10,
            gap: 8,
          }}
        >
          {/* Assignee */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
            {task.assigned_display_name ? (
              <>
                <span style={{ fontSize: 12 }}>👤</span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#4b5563',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.assigned_display_name}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                Unassigned
              </span>
            )}
          </div>

          {/* Status Badge (optional) */}
          {showStatus && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: status.color,
                background: status.bg,
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              {status.label}
            </span>
          )}

          {/* Quick Actions - only Done and Blocked buttons now, no play button */}
          {onStatusChange && !compact && !showDropdown && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {canMoveToDone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(task, 'done')
                  }}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    border: '1px solid #dcfce7',
                    borderRadius: 4,
                    background: '#f0fdf4',
                    color: '#15803d',
                    cursor: 'pointer',
                  }}
                  title="Mark as done"
                >
                  ✓
                </button>
              )}
              {canMoveToBlocked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(task, 'blocked')
                  }}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    border: '1px solid #fef2f2',
                    borderRadius: 4,
                    background: '#fef2f2',
                    color: '#dc2626',
                    cursor: 'pointer',
                  }}
                  title="Mark as blocked"
                >
                  ⚠
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Spawn Agent Dialog */}
      <SpawnAgentDialog
        task={task}
        isOpen={spawnDialogOpen}
        onClose={() => setSpawnDialogOpen(false)}
        onSpawn={handleSpawn}
      />
    </>
  )
})
