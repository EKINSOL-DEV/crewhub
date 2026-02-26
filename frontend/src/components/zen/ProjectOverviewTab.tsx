/**
 * ProjectOverviewTab — Shows project info, task stats, room list when a project is selected.
 */
import { useState, useEffect } from 'react'
import { useProjects, type ProjectOverview } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'

const VAR_ZEN_FG = 'var(--zen-fg)'
const VAR_ZEN_FG_MUTED = 'var(--zen-fg-muted)'

interface ProjectOverviewTabProps {
  readonly projectId: string
  readonly projectName?: string | null
  readonly onSwitchToDocuments?: () => void
}

export function ProjectOverviewTab({
  projectId,
  projectName: _projectName,
  onSwitchToDocuments,
}: Readonly<ProjectOverviewTabProps>) {
  const { projects, fetchOverview } = useProjects()
  const { taskCounts, tasks } = useTasks({ projectId })
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const project = projects.find((p) => p.id === projectId)

  useEffect(() => {
    setLoading(true)
    fetchOverview().then((result) => {
      if (result.success) {
        const found = result.projects.find((p) => p.id === projectId)
        setOverview(found || null)
      }
      setLoading(false)
    })
  }, [projectId, fetchOverview])

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: VAR_ZEN_FG_MUTED, fontSize: 13 }}>
        Loading project overview...
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: VAR_ZEN_FG_MUTED, fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
        Project not found
      </div>
    )
  }

  const totalTasks = Object.values(taskCounts).reduce((a, b) => a + b, 0)
  const activeTasks = tasks.filter((t) => t.status !== 'done').slice(0, 5)

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflow: 'auto',
        flex: 1,
      }}
    >
      {/* Project Header Card */}
      <div
        style={{
          padding: '16px',
          background: (project.color || '#6b7280') + '10',
          borderRadius: 12,
          border: `1px solid ${project.color || '#6b7280'}20`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: project.color || '#6b7280',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 20, flexShrink: 0 }}>{project.icon || '📋'}</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: VAR_ZEN_FG,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
          </span>
        </div>
        {project.description && (
          <div
            style={{
              fontSize: 13,
              color: VAR_ZEN_FG_MUTED,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {project.description}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: project.status === 'active' ? '#15803d' : '#6b7280',
              background: project.status === 'active' ? '#dcfce7' : '#f3f4f6',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatCard label="Tasks" value={totalTasks} icon="📋" />
        <StatCard
          label="Rooms"
          value={overview?.room_count ?? project.rooms?.length ?? 0}
          icon="🏠"
        />
        <StatCard label="Agents" value={overview?.agent_count ?? 0} icon="🤖" />
      </div>

      {/* Task Status Breakdown */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: VAR_ZEN_FG_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          Task Status
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <TaskBadge count={taskCounts.todo} label="To Do" color="#6b7280" />
          <TaskBadge count={taskCounts.in_progress} label="In Progress" color="#2563eb" />
          <TaskBadge count={taskCounts.review} label="Review" color="#7c3aed" />
          <TaskBadge count={taskCounts.blocked} label="Blocked" color="#dc2626" />
          <TaskBadge count={taskCounts.done} label="Done" color="#15803d" />
        </div>
      </div>

      {/* Active Tasks Preview */}
      {activeTasks.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: VAR_ZEN_FG_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Active Tasks
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--zen-bg-hover, rgba(0,0,0,0.03))',
                  borderRadius: 6,
                  fontSize: 12,
                  color: VAR_ZEN_FG,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: (() => {
                      if (task.status === 'in_progress') return '#2563eb'
                      if (task.status === 'blocked') return '#dc2626'
                      if (task.status === 'review') return '#7c3aed'
                      return '#6b7280'
                    })(),
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {onSwitchToDocuments && project.folder_path && (
        <button
          onClick={onSwitchToDocuments}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid var(--zen-border, rgba(0,0,0,0.1))',
            background: 'var(--zen-bg-hover, transparent)',
            color: 'var(--zen-accent)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          📂 View Documents →
        </button>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: Readonly<{ label: string; value: number; icon: string }>) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--zen-bg-hover, rgba(0,0,0,0.03))',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: VAR_ZEN_FG }}>{value}</div>
      <div style={{ fontSize: 11, color: VAR_ZEN_FG_MUTED, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function TaskBadge({ count, label, color }: Readonly<{ count: number; label: string; color: string }>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: color + '10',
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 10, color: VAR_ZEN_FG_MUTED }}>{label}</span>
    </div>
  )
}
