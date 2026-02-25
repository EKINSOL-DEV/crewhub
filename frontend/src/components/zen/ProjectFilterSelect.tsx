/**
 * ProjectFilterSelect — Shared dropdown for filtering by project in Zen Mode panels.
 * Used in Tasks, Kanban, and Projects panels.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjects, type Project } from '@/hooks/useProjects'
import { ProjectManagerModal } from './ProjectManagerModal'

interface ProjectFilterSelectProps {
  readonly currentProjectId: string | null | undefined
  readonly currentProjectName?: string | null
  readonly onSelect: (projectId: string | null, projectName: string, projectColor?: string) => void
  readonly compact?: boolean
}

export function ProjectFilterSelect({
  currentProjectId,
  currentProjectName,
  onSelect,
  compact = false,
}: ProjectFilterSelectProps) {
  const { projects, isLoading } = useProjects()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showManager, setShowManager] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const filteredProjects = projects.filter(
    (p) => p.status === 'active' && p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = useCallback(
    (project: Project | null) => {
      if (project) {
        onSelect(project.id, project.name, project.color || undefined)
      } else {
        onSelect(null, 'All Projects')
      }
      setIsOpen(false)
      setSearch('')
    },
    [onSelect]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearch('')
    }
  }, [])

  const displayLabel = currentProjectId
    ? currentProjectName || projects.find((p) => p.id === currentProjectId)?.name || 'Project'
    : 'All Projects'

  const currentProject = currentProjectId ? projects.find((p) => p.id === currentProjectId) : null

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter by project"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: compact ? '4px 8px' : '5px 10px',
          borderRadius: 6,
          border: '1px solid var(--zen-border, hsl(var(--border)))',
          background: 'var(--zen-bg-panel, transparent)',
          color: 'var(--zen-fg, hsl(var(--foreground)))',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          maxWidth: compact ? 140 : 200,
          transition: 'border-color 0.15s',
        }}
      >
        {currentProject?.color && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: currentProject.color,
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayLabel}
        </span>
        <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>▼</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select project"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 220,
            maxWidth: 300,
            maxHeight: 320,
            background: 'var(--zen-bg-panel, white)',
            border: '1px solid var(--zen-border, hsl(var(--border)))',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 50,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid var(--zen-border, hsl(var(--border)))',
                background: 'var(--zen-bg-hover, transparent)',
                color: 'var(--zen-fg, inherit)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Options */}
          <div style={{ overflow: 'auto', padding: '4px 4px 8px' }}>
            {/* All Projects option */}
            <button
              role="option"
              aria-selected={!currentProjectId}
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: 'none',
                background: !currentProjectId
                  ? 'var(--zen-bg-active, rgba(59,130,246,0.1))'
                  : 'transparent',
                color: 'var(--zen-fg, inherit)',
                fontSize: 12,
                fontWeight: !currentProjectId ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (currentProjectId)
                  e.currentTarget.style.background = 'var(--zen-bg-hover, rgba(0,0,0,0.05))'
              }}
              onMouseLeave={(e) => {
                if (currentProjectId) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: 14 }}>🌐</span>
              <span>All Projects</span>
            </button>

            {/* Divider */}
            <div
              style={{
                borderTop: '1px solid var(--zen-border, rgba(0,0,0,0.06))',
                margin: '4px 8px',
              }}
            />

            {isLoading ? (
              <div
                style={{
                  padding: '12px',
                  fontSize: 12,
                  color: 'var(--zen-fg-muted, #9ca3af)',
                  textAlign: 'center',
                }}
              >
                Loading...
              </div>
            ) : filteredProjects.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  fontSize: 12,
                  color: 'var(--zen-fg-muted, #9ca3af)',
                  textAlign: 'center',
                }}
              >
                {search ? 'No projects match' : 'No active projects'}
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = project.id === currentProjectId
                return (
                  <button
                    key={project.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(project)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: isSelected
                        ? 'var(--zen-bg-active, rgba(59,130,246,0.1))'
                        : 'transparent',
                      color: 'var(--zen-fg, inherit)',
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = 'var(--zen-bg-hover, rgba(0,0,0,0.05))'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: project.color || '#6b7280',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{project.icon || '📋'}</span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {project.name}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {/* Manage Projects button */}
          <div
            style={{
              borderTop: '1px solid var(--zen-border, rgba(0,0,0,0.06))',
              padding: '4px 4px 4px',
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false)
                setSearch('')
                setShowManager(true)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: 'var(--zen-fg-muted, #9ca3af)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--zen-bg-hover, rgba(0,0,0,0.05))')
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 14 }}>⚙️</span>
              <span>Manage Projects...</span>
            </button>
          </div>
        </div>
      )}

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        onProjectSelect={onSelect}
      />
    </div>
  )
}
