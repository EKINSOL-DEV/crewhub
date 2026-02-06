import { memo } from 'react'
import type { Task, TaskStatus, TaskPriority } from '@/hooks/useTasks'

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
  task: Task
  compact?: boolean
  showStatus?: boolean
  onClick?: (task: Task) => void
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void
}

// ── Component ──────────────────────────────────────────────────

export const TaskCard = memo(function TaskCard({
  task,
  compact = false,
  showStatus = false,
  onClick,
  onStatusChange,
}: TaskCardProps) {
  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]

  const handleClick = () => {
    onClick?.(task)
  }

  // Quick status change buttons
  const canMoveToInProgress = task.status === 'todo' || task.status === 'blocked'
  const canMoveToDone = task.status === 'in_progress' || task.status === 'review'
  const canMoveToBlocked = task.status === 'in_progress'

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#ffffff',
        borderRadius: 8,
        padding: compact ? '8px 10px' : '12px 14px',
        borderLeft: `3px solid ${priority.color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, transform 0.15s',
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
      {/* Header: Title + Priority Badge */}
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

        {/* Quick Actions (if onStatusChange provided) */}
        {onStatusChange && !compact && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {canMoveToInProgress && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(task, 'in_progress')
                }}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  border: '1px solid #dbeafe',
                  borderRadius: 4,
                  background: '#eff6ff',
                  color: '#2563eb',
                  cursor: 'pointer',
                }}
                title="Start working"
              >
                ▶
              </button>
            )}
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
  )
})
