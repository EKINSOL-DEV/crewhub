/**
 * Mobile Projects Panel
 * Project list with status overview and quick actions
 */

import { useState, useMemo } from 'react'
import { ArrowLeft, Folder, TrendingUp } from 'lucide-react'
import { useProjects, type Project } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'

const BORDER_1PX_SOLID_RGBA_255_255_255_0_0 = '1px solid rgba(255, 255, 255, 0.06)'
const RGBA_255_255_255_0_02 = 'rgba(255, 255, 255, 0.02)'

interface MobileProjectsPanelProps {
  readonly onBack: () => void
}

// ── Project Card ──────────────────────────────────────────────

interface ProjectCardProps {
  readonly project: Project
  readonly taskCount: number
  readonly completedCount: number
  readonly assignedAgents: string[]
  readonly onTap: () => void
}

function ProjectCard({
  project,
  taskCount,
  completedCount,
  assignedAgents,
  onTap,
}: ProjectCardProps) {
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0
  let statusColor: string
  if (project.status === 'active') {
    statusColor = '#22c55e'
  } else if (project.status === 'archived') {
    statusColor = '#64748b'
  } else {
    statusColor = '#f59e0b'
  }

  return (
    <button
      onClick={onTap}
      style={{
        width: '100%',
        padding: '16px',
        background: RGBA_255_255_255_0_02,
        border: `1px solid ${project.color ? project.color + '40' : 'rgba(255, 255, 255, 0.06)'}`,
        borderRadius: 12,
        textAlign: 'left',
        color: '#e2e8f0',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Color indicator */}
        {project.color && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${project.color}20`,
              border: `1px solid ${project.color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            <Folder size={20} color={project.color} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
            {project.name}
          </div>
          {project.description && (
            <div
              style={{
                fontSize: 12,
                color: '#94a3b8',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {project.description}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            background: `${statusColor}20`,
            fontSize: 10,
            fontWeight: 600,
            color: statusColor,
            textTransform: 'capitalize',
            flexShrink: 0,
          }}
        >
          {project.status}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📋</span>
          <span>
            {taskCount} task{taskCount === 1 ? '' : 's'}
          </span>
        </div>
        {taskCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={12} />
            <span>{progress}% complete</span>
          </div>
        )}
        {assignedAgents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>👥</span>
            <span>
              {assignedAgents.length} agent{assignedAgents.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {taskCount > 0 && (
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: project.color || '#8b5cf6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </button>
  )
}

// ── Project Detail Modal ──────────────────────────────────────

interface ProjectDetailModalProps {
  readonly project: Project
  readonly taskCount: number
  readonly completedCount: number
  readonly inProgressCount: number
  readonly blockedCount: number
  readonly assignedAgents: string[]
  readonly onClose: () => void
}

function ProjectDetailModal({
  project,
  taskCount,
  completedCount,
  inProgressCount,
  blockedCount,
  assignedAgents,
  onClose,
}: ProjectDetailModalProps) {
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0
  let statusColor: string
  if (project.status === 'active') {
    statusColor = '#22c55e'
  } else if (project.status === 'archived') {
    statusColor = '#64748b'
  } else {
    statusColor = '#f59e0b'
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'flex-end',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onClose()
      }}
      role="button"
      tabIndex={0}
    >
      <div // NOSONAR: onClick only prevents event bubble, not interactive
        style={{
          width: '100%',
          maxHeight: '85vh',
          background: '#0f172a',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-modal="true"
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {project.color && (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${project.color}20`,
                  border: `1px solid ${project.color}40`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Folder size={24} color={project.color} />
              </div>
            )}
            <h3 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
              {project.name}
            </h3>
            {project.description && (
              <p style={{ fontSize: 14, lineHeight: 1.5, color: '#94a3b8', margin: 0 }}>
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            padding: '6px 12px',
            borderRadius: 8,
            background: `${statusColor}20`,
            fontSize: 13,
            fontWeight: 600,
            color: statusColor,
            textTransform: 'capitalize',
            alignSelf: 'flex-start',
          }}
        >
          {project.status}
        </div>

        {/* Task Stats */}
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, fontWeight: 600 }}>
            TASK BREAKDOWN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              style={{
                padding: '12px',
                background: RGBA_255_255_255_0_02,
                border: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>
                {taskCount}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Total Tasks</div>
            </div>
            <div
              style={{
                padding: '12px',
                background: RGBA_255_255_255_0_02,
                border: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>
                {completedCount}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Completed</div>
            </div>
            <div
              style={{
                padding: '12px',
                background: RGBA_255_255_255_0_02,
                border: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                {inProgressCount}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>In Progress</div>
            </div>
            <div
              style={{
                padding: '12px',
                background: RGBA_255_255_255_0_02,
                border: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                {blockedCount}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Blocked</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            PROGRESS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                flex: 1,
                height: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: project.color || '#8b5cf6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#f1f5f9',
                minWidth: 50,
                textAlign: 'right',
              }}
            >
              {progress}%
            </div>
          </div>
        </div>

        {/* Assigned Agents */}
        {assignedAgents.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
              ASSIGNED AGENTS ({assignedAgents.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {assignedAgents.map((agent, _i) => (
                <div
                  key={JSON.stringify(agent)}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>👤</span>
                  <span>{agent}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function MobileProjectsPanel({ onBack }: MobileProjectsPanelProps) {
  const { projects, isLoading, error } = useProjects()
  const { tasks } = useTasks({})
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Calculate stats for each project
  const projectStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        taskCount: number
        completedCount: number
        inProgressCount: number
        blockedCount: number
        assignedAgents: string[]
      }
    >()

    for (const project of projects) {
      const projectTasks = tasks.filter((t) => t.project_id === project.id)
      const completed = projectTasks.filter((t) => t.status === 'done').length
      const inProgress = projectTasks.filter((t) => t.status === 'in_progress').length
      const blocked = projectTasks.filter((t) => t.status === 'blocked').length
      const agents = Array.from(
        new Set(projectTasks.map((t) => t.assigned_display_name).filter(Boolean))
      )

      stats.set(project.id, {
        taskCount: projectTasks.length,
        completedCount: completed,
        inProgressCount: inProgress,
        blockedCount: blocked,
        assignedAgents: agents as string[],
      })
    }

    return stats
  }, [projects, tasks])

  const activeProjects = projects.filter((p) => p.status === 'active')
  const archivedProjects = projects.filter((p) => p.status === 'archived')

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: BORDER_1PX_SOLID_RGBA_255_255_255_0_0,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#f1f5f9' }}>Projects</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {activeProjects.length} active · {archivedProjects.length} archived
          </div>
        </div>
      </header>

      {/* Project List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '16px',
        }}
      >
        {isLoading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            Loading projects...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14 }}>Failed to load projects</div>
          </div>
        )}

        {!isLoading && !error && activeProjects.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14 }}>No active projects</div>
          </div>
        )}

        {!isLoading && !error && activeProjects.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Active Projects */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 12,
                }}
              >
                Active Projects ({activeProjects.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeProjects.map((project) => {
                  const stats = projectStats.get(project.id)
                  if (!stats) return null
                  return (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      taskCount={stats.taskCount}
                      completedCount={stats.completedCount}
                      assignedAgents={stats.assignedAgents}
                      onTap={() => setSelectedProject(project)}
                    />
                  )
                })}
              </div>
            </div>

            {/* Archived Projects */}
            {archivedProjects.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 12,
                  }}
                >
                  Archived Projects ({archivedProjects.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {archivedProjects.map((project) => {
                    const stats = projectStats.get(project.id)
                    if (!stats) return null
                    return (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        taskCount={stats.taskCount}
                        completedCount={stats.completedCount}
                        assignedAgents={stats.assignedAgents}
                        onTap={() => setSelectedProject(project)}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          taskCount={projectStats.get(selectedProject.id)?.taskCount || 0}
          completedCount={projectStats.get(selectedProject.id)?.completedCount || 0}
          inProgressCount={projectStats.get(selectedProject.id)?.inProgressCount || 0}
          blockedCount={projectStats.get(selectedProject.id)?.blockedCount || 0}
          assignedAgents={projectStats.get(selectedProject.id)?.assignedAgents || []}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}
