/**
 * Zen Standalone App
 *
 * A lightweight app that provides Zen Mode as a standalone experience.
 * Shares all code/components/API with CrewHub via path aliases.
 * No 3D world, no HQ - just focused Zen Mode.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RoomsProvider, useRoomsContext } from '@/contexts/RoomsContext'
import { ZenModeProvider, useZenMode, type ZenProjectFilter } from '@/components/zen/hooks/useZenMode'
import { ZenMode } from '@/components/zen/ZenMode'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { API_BASE } from '@/lib/api'
import { ProjectManagerModal } from '@/components/zen/ProjectManagerModal'

// ── Workspace Selector ─────────────────────────────────────────

interface Project {
  id: string
  name: string
  color: string | null
  description: string | null
}

function WorkspaceSelector({ onSelect, onEnterAll }: {
  onSelect: (project: Project) => void
  onEnterAll: () => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showManager, setShowManager] = useState(false)

  const refreshProjects = useCallback(() => {
    fetch(`${API_BASE}/projects`)
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  return (
    <div className="zen-standalone-selector" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#1a1b26',
      color: '#a9b1d6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 600, padding: '0 24px' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 300,
          color: '#c0caf5',
          marginBottom: '0.5rem',
          letterSpacing: '-0.02em',
        }}>
          ⚡ Zen Mode
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#565f89', marginBottom: '2rem' }}>
          Focused workspace • Shared with CrewHub
        </p>

        <button
          onClick={onEnterAll}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 20px',
            marginBottom: '12px',
            background: '#24283b',
            border: '1px solid #3b4261',
            borderRadius: '8px',
            color: '#7aa2f7',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#2a2e45'
            e.currentTarget.style.borderColor = '#7aa2f7'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#24283b'
            e.currentTarget.style.borderColor = '#3b4261'
          }}
        >
          🚀 Enter Zen Mode{' '}
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#565f89', marginTop: 4 }}>
            All sessions • No project filter
          </span>
        </button>

        {loading ? (
          <p style={{ color: '#565f89', fontSize: '0.875rem' }}>Loading projects...</p>
        ) : projects.length > 0 && (
          <>
            <div style={{
              fontSize: '0.75rem',
              color: '#565f89',
              margin: '20px 0 12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Or focus on a project
            </div>
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => onSelect(project)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 20px',
                  marginBottom: '8px',
                  background: '#24283b',
                  border: '1px solid #3b4261',
                  borderRadius: '8px',
                  color: '#c0caf5',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#2a2e45'
                  e.currentTarget.style.borderColor = project.color || '#7aa2f7'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#24283b'
                  e.currentTarget.style.borderColor = '#3b4261'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: project.color || '#7aa2f7',
                  marginRight: 10,
                }} />
                {project.name}
                {project.description && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#565f89', marginTop: 2, marginLeft: 18 }}>
                    {project.description}
                  </span>
                )}
              </button>
            ))}
          </>
        )}

        {/* Manage Projects button */}
        <button
          onClick={() => setShowManager(true)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px 20px',
            marginTop: '16px',
            background: 'transparent',
            border: '1px solid #3b4261',
            borderRadius: '8px',
            color: '#565f89',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#7aa2f7'
            e.currentTarget.style.color = '#7aa2f7'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#3b4261'
            e.currentTarget.style.color = '#565f89'
          }}
        >
          ⚙️ Manage Projects
        </button>
      </div>

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={showManager}
        onClose={() => { setShowManager(false); refreshProjects() }}
        onProjectSelect={(id, name, color) => {
          setShowManager(false)
          onSelect({ id, name, color: color || null, description: null })
        }}
      />
    </div>
  )
}

// ── Inner App (uses hooks that need providers) ─────────────────

function ZenStandaloneInner() {
  const zenMode = useZenMode()
  const { connected } = useSessionsStream()
  const { rooms, getRoomForSession } = useRoomsContext()

  // Compute room name for zen mode
  const zenRoomName = useMemo(() => {
    if (!zenMode.selectedAgentId) return undefined
    const roomId = getRoomForSession(zenMode.selectedAgentId)
    if (!roomId) return undefined
    return rooms.find(r => r.id === roomId)?.name
  }, [zenMode.selectedAgentId, getRoomForSession, rooms])

  // Handle workspace selection
  const handleSelectProject = useCallback((project: Project) => {
    const filter: ZenProjectFilter = {
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color || undefined,
    }
    zenMode.enterWithProject(filter)
  }, [zenMode])

  const handleEnterAll = useCallback(() => {
    zenMode.enter()
  }, [zenMode])

  // Handle exit: go back to selector instead of closing
  const handleExit = useCallback(() => {
    zenMode.exit()
  }, [zenMode])

  if (!zenMode.isActive) {
    return (
      <WorkspaceSelector
        onSelect={handleSelectProject}
        onEnterAll={handleEnterAll}
      />
    )
  }

  return (
    <ZenMode
      sessionKey={zenMode.selectedAgentId}
      agentName={zenMode.selectedAgentName}
      agentIcon={zenMode.selectedAgentIcon}
      agentColor={zenMode.selectedAgentColor}
      roomName={zenRoomName}
      connected={connected}
      onExit={handleExit}
      exitLabel="Projects"
      exitIcon="📋"
      projectFilter={zenMode.projectFilter}
      onClearProjectFilter={zenMode.clearProjectFilter}
    />
  )
}

// ── Root App ───────────────────────────────────────────────────

export function ZenStandaloneApp() {
  return (
    <RoomsProvider>
      <ZenModeProvider>
        <ZenStandaloneInner />
      </ZenModeProvider>
    </RoomsProvider>
  )
}
