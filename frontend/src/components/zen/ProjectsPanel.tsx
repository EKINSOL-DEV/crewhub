/**
 * ProjectsPanel — Replaces ZenDocumentsPanel.
 * Shows either a project list (no filter) or a tabbed view (Overview | Documents).
 */
import { useState, useCallback } from 'react'
import { useProjects, type Project } from '@/hooks/useProjects'
import { ProjectFilterSelect } from './ProjectFilterSelect'
import { ProjectOverviewTab } from './ProjectOverviewTab'
import { ZenDocumentsPanel } from './ZenDocumentsPanel'

interface ProjectsPanelProps {
  projectId?: string | null
  projectName?: string | null
  onProjectFilterChange?: (projectId: string | null, projectName: string, projectColor?: string) => void
}

type ViewTab = 'overview' | 'documents'

export function ProjectsPanel({ projectId, projectName, onProjectFilterChange }: ProjectsPanelProps) {
  const [activeView, setActiveView] = useState<ViewTab>('overview')
  const { projects } = useProjects()

  const handleFilterSelect = useCallback((id: string | null, name: string, color?: string) => {
    onProjectFilterChange?.(id, name, color)
    // Switch to overview when selecting a new project
    if (id) setActiveView('overview')
  }, [onProjectFilterChange])

  // No project selected → show project list
  if (!projectId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header with filter */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>📂</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
              Projects
            </span>
          </div>
          {onProjectFilterChange && (
            <ProjectFilterSelect
              currentProjectId={projectId}
              currentProjectName={projectName}
              onSelect={handleFilterSelect}
              compact
            />
          )}
        </div>

        {/* Project list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {projects.filter(p => p.status === 'active').length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'hsl(var(--muted-foreground))',
              fontSize: 13,
              gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>📋</span>
              <span>No active projects</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.filter(p => p.status === 'active').map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => handleFilterSelect(project.id, project.name, project.color || undefined)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Project selected → tabbed view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header with filter */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>📂</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--zen-fg, hsl(var(--foreground)))' }}>
            {projectName || 'Project'}
          </span>
        </div>
        {onProjectFilterChange && (
          <ProjectFilterSelect
            currentProjectId={projectId}
            currentProjectName={projectName}
            onSelect={handleFilterSelect}
            compact
          />
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--zen-border, hsl(var(--border)))',
        padding: '0 12px',
        flexShrink: 0,
      }}>
        <TabButton active={activeView === 'overview'} onClick={() => setActiveView('overview')} label="📋 Overview" />
        <TabButton active={activeView === 'documents'} onClick={() => setActiveView('documents')} label="📂 Documents" />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeView === 'overview' ? (
          <ProjectOverviewTab
            projectId={projectId}
            projectName={projectName}
            onSwitchToDocuments={() => setActiveView('documents')}
          />
        ) : (
          <ZenDocumentsPanel
            projectId={projectId}
            projectName={projectName}
          />
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--zen-accent, #3b82f6)' : 'transparent'}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--secondary))',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--muted))' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--secondary))' }}
    >
      <span style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: project.color || '#6b7280',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 16, flexShrink: 0 }}>{project.icon || '📋'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'hsl(var(--foreground))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.name}
        </div>
        {project.description && (
          <div style={{
            fontSize: 11,
            color: 'hsl(var(--muted-foreground))',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.description}
          </div>
        )}
      </div>
    </button>
  )
}
