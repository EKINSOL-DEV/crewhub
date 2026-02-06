import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Task, TaskStatus, TaskPriority } from '@/hooks/useTasks'

// ── Props ──────────────────────────────────────────────────────

interface TaskWall3DProps {
  tasks: Task[]
  roomId: string
  position?: [number, number, number]
  width?: number
  height?: number
  onTaskClick?: (task: Task) => void
}

// ── Priority & Status Colors ───────────────────────────────────

const priorityColors: Record<TaskPriority, string> = {
  urgent: '#dc2626',
  high: '#ea580c',
  medium: '#3b82f6',
  low: '#9ca3af',
}

const statusConfig: Record<TaskStatus, { label: string; icon: string; bg: string }> = {
  todo: { label: 'TODO', icon: '📋', bg: '#f3f4f6' },
  in_progress: { label: 'DOING', icon: '🔄', bg: '#dbeafe' },
  review: { label: 'REVIEW', icon: '👀', bg: '#ede9fe' },
  blocked: { label: 'BLOCKED', icon: '🚫', bg: '#fef2f2' },
  done: { label: 'DONE', icon: '✅', bg: '#dcfce7' },
}

// ── Component ──────────────────────────────────────────────────

export function TaskWall3D({
  tasks,
  roomId: _roomId,  // Reserved for future use
  position = [0, 1.8, 5.5],  // Back wall (far from entrance, z+ is back)
  rotation = [0, Math.PI, 0],  // Rotate 180° to face into room (toward -Z)
  width = 4,
  height = 2,
  onTaskClick,
}: TaskWall3DProps & { rotation?: [number, number, number] }) {
  // Filter to active tasks only (not done)
  const activeTasks = useMemo(() => 
    tasks.filter(t => t.status !== 'done'),
    [tasks]
  )

  // Group by status for columns
  const columns: { status: TaskStatus; tasks: Task[] }[] = useMemo(() => {
    const todoTasks = activeTasks.filter(t => t.status === 'todo')
    const doingTasks = activeTasks.filter(t => t.status === 'in_progress')
    const blockedTasks = activeTasks.filter(t => t.status === 'blocked')
    
    return [
      { status: 'todo' as TaskStatus, tasks: todoTasks },
      { status: 'in_progress' as TaskStatus, tasks: doingTasks },
      { status: 'blocked' as TaskStatus, tasks: blockedTasks },
    ]
  }, [activeTasks])

  // Don't render if no active tasks
  if (activeTasks.length === 0) return null

  const maxTasksPerColumn = 4

  return (
    <group position={position} rotation={rotation}>
      {/* Whiteboard backing */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial 
          color="#f8fafc" 
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Frame border */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.1, height + 0.1]} />
        <meshStandardMaterial 
          color="#475569" 
          roughness={0.5}
        />
      </mesh>

      {/* HTML overlay for task cards */}
      <Html
        position={[0, 0, 0.01]}
        center
        transform
        scale={0.25}
        style={{
          width: `${width * 100}px`,
          height: `${height * 100}px`,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'transparent',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '24px' }}>📋</span>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Task Board
            </span>
            <span style={{
              fontSize: '14px',
              color: '#64748b',
              background: '#e2e8f0',
              padding: '4px 10px',
              borderRadius: '6px',
            }}>
              {activeTasks.length} active
            </span>
          </div>

          {/* Columns */}
          <div style={{
            display: 'flex',
            gap: '10px',
            flex: 1,
            minHeight: 0,
          }}>
            {columns.map(({ status, tasks: columnTasks }) => {
              const config = statusConfig[status]
              const displayTasks = columnTasks.slice(0, maxTasksPerColumn)
              const hiddenCount = columnTasks.length - displayTasks.length

              return (
                <div
                  key={status}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    minWidth: 0,
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    background: config.bg,
                    borderRadius: '6px',
                  }}>
                    <span style={{ fontSize: '16px' }}>{config.icon}</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#374151',
                    }}>
                      {config.label}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '2px 6px',
                      borderRadius: '8px',
                    }}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    overflow: 'hidden',
                  }}>
                    {displayTasks.map(task => (
                      <StickyNote
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                      />
                    ))}

                    {hiddenCount > 0 && (
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        textAlign: 'center',
                        padding: '6px',
                      }}>
                        +{hiddenCount} more
                      </div>
                    )}

                    {columnTasks.length === 0 && (
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        textAlign: 'center',
                        padding: '12px 6px',
                        fontStyle: 'italic',
                      }}>
                        —
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Html>
    </group>
  )
}

// ── Sticky Note Task Card ──────────────────────────────────────

function StickyNote({
  task,
  onClick,
}: {
  task: Task
  onClick?: () => void
}) {
  const priorityColor = priorityColors[task.priority]

  // Slight rotation for sticky note effect
  const rotation = useMemo(() => {
    const hash = task.id.charCodeAt(0) + task.id.charCodeAt(1)
    return (hash % 5 - 2) * 0.5  // -1 to +1 degrees
  }, [task.id])

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fef9c3',  // Yellow sticky note
        padding: '10px 12px',
        borderRadius: '4px',
        borderLeft: `4px solid ${priorityColor}`,
        boxShadow: '2px 3px 6px rgba(0,0,0,0.15)',
        cursor: onClick ? 'pointer' : 'default',
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = `rotate(0deg) scale(1.02)`
          e.currentTarget.style.boxShadow = '3px 5px 10px rgba(0,0,0,0.2)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${rotation}deg)`
        e.currentTarget.style.boxShadow = '2px 3px 6px rgba(0,0,0,0.15)'
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: '#1f2937',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {task.title}
      </div>

      {/* Assignee */}
      {task.assigned_display_name && (
        <div style={{
          marginTop: '6px',
          fontSize: '11px',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span>👤</span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {task.assigned_display_name}
          </span>
        </div>
      )}
    </div>
  )
}
