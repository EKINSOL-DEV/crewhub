import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { Project } from '@/hooks/useProjects'
import { API_BASE } from '@/lib/api'
import { useDemoMode } from '@/contexts/DemoContext'

/** Default projects base path (overridden by settings) */
const DEFAULT_PROJECTS_BASE = '~/Projects'

// ── Types ──────────────────────────────────────────────────────

interface ProjectPickerProps {
  readonly projects: Project[]
  readonly currentProjectId: string | null
  readonly onSelect: (projectId: string) => void
  readonly onCreate: (project: {
    name: string
    icon?: string
    color?: string
    folder_path?: string
  }) => Promise<{ success: boolean; project?: Project }>
  readonly onClose: () => void
}

// ── Color presets ──────────────────────────────────────────────

const COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#78716c',
]

const ICON_PRESETS = [
  '🚀',
  '🏗️',
  '🎨',
  '📊',
  '🔬',
  '💡',
  '📱',
  '🌐',
  '🛡️',
  '📝',
  '🎯',
  '⚡',
  '🔧',
  '📦',
  '🎬',
  '🧪',
]

// ── Component ──────────────────────────────────────────────────

export function ProjectPicker({
  projects,
  currentProjectId,
  onSelect,
  onCreate,
  onClose,
}: ProjectPickerProps) {
  const { isDemoMode } = useDemoMode()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [newIcon, setNewIcon] = useState('🚀')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [discoveredFolders, setDiscoveredFolders] = useState<
    { name: string; path: string; file_count: number; has_readme: boolean; has_docs: boolean }[]
  >([])
  const [projectsBasePath, setProjectsBasePath] = useState(DEFAULT_PROJECTS_BASE)

  // Fetch configured projects base path from settings
  useEffect(() => {
    fetch(`${API_BASE}/settings/projects_base_path`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.value) setProjectsBasePath(data.value)
      })
      .catch(() => {})
  }, [])

  // Fetch available project folders when showing create form
  useEffect(() => {
    if (!showCreate) return
    fetch(`${API_BASE}/project-folders/discover`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.folders) setDiscoveredFolders(data.folders)
      })
      .catch(() => {})
  }, [showCreate])
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = projects.filter((p) => p.status === 'active' || p.status === 'paused')
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }
    // Sort: recently updated first, current project excluded
    return list.filter((p) => p.id !== currentProjectId).sort((a, b) => b.updated_at - a.updated_at)
  }, [projects, search, currentProjectId])

  // Auto-generated folder path preview
  const autoFolderPath = useMemo(() => {
    if (!newName.trim()) return ''
    const slug = newName
      .trim()
      .replaceAll(/[^a-zA-Z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '')
    return `${projectsBasePath}/${slug}`
  }, [newName, projectsBasePath])

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    setCreateError(null)

    try {
      const folderPath = newFolderPath.trim() || undefined
      const result = await onCreate({
        name: newName.trim(),
        icon: newIcon,
        color: newColor,
        folder_path: folderPath,
      })

      setIsCreating(false)
      if (result && result.success && result.project) {
        onSelect(result.project.id)
      } else if (result) {
        setCreateError(
          'error' in result ? (result as { error: string }).error : 'Failed to create project'
        )
      } else {
        setCreateError('No response from create - please try again')
      }
    } catch (err) {
      console.error('[ProjectPicker] handleCreate error:', err)
      setIsCreating(false)
      setCreateError(err instanceof Error ? err.message : 'Unexpected error')
    }
  }, [newName, newIcon, newColor, newFolderPath, onCreate, onSelect])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.97)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 30,
        animation: 'pickerFadeIn 0.2s ease-out',
      }}
    >
      {/* Demo mode warning */}
      {isDemoMode && (
        <div
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '1px solid #fcd34d',
            fontSize: 12,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>🎮</span>
          <span>
            <strong>Demo Mode</strong> — Changes won't persist. Two rooms already have projects
            linked for you to explore!
          </span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
          {showCreate ? '✨ New Project' : '📋 Select Project'}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: 'rgba(0,0,0,0.05)',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {showCreate ? (
        /* Create new project form */
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Name */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 4,
                display: 'block',
              }}
            >
              Project Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Website Redesign"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'rgba(0,0,0,0.03)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) handleCreate()
              }}
            />
          </div>

          {/* Icon selector */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 6,
                display: 'block',
              }}
            >
              Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ICON_PRESETS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: newIcon === icon ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.08)',
                    background: newIcon === icon ? 'rgba(59,130,246,0.08)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color selector */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 6,
                display: 'block',
              }}
            >
              Color
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: newColor === color ? '3px solid #1f2937' : '2px solid transparent',
                    background: color,
                    cursor: 'pointer',
                    outline: newColor === color ? '2px solid white' : 'none',
                    outlineOffset: -4,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Folder Path */}
          <div>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: 4,
                display: 'block',
              }}
            >
              Project Folder
            </label>
            <input
              type="text"
              placeholder={autoFolderPath || `${projectsBasePath}/MyProject`}
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'rgba(0,0,0,0.03)',
                fontSize: 12,
                outline: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
              }}
            />
            {!newFolderPath && autoFolderPath && (
              <div style={{ fontSize: 10, color: '#059669', marginTop: 3 }}>
                Auto-generated: {autoFolderPath}
              </div>
            )}
            {/* Quick-link suggestions from discovered project folders */}
            {discoveredFolders.length > 0 && !newFolderPath && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {discoveredFolders
                  .filter((f) => f.name.toLowerCase().includes(newName.toLowerCase()) || !newName)
                  .slice(0, 5)
                  .map((folder) => (
                    <button
                      key={folder.path}
                      type="button"
                      onClick={() => {
                        setNewFolderPath(folder.path)
                        if (!newName) setNewName(folder.name)
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: 'rgba(59,130,246,0.05)',
                        color: '#3b82f6',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      📂 {folder.name}
                      {folder.has_docs && <span style={{ color: '#059669' }}>📝</span>}
                    </button>
                  ))}
              </div>
            )}
            {!discoveredFolders.length && (
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                Path to project files for the docs browser
              </div>
            )}
          </div>

          {/* Error */}
          {createError && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: '#fef2f2',
                color: '#991b1b',
                fontSize: 12,
              }}
            >
              {createError}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => {
                setShowCreate(false)
                setCreateError(null)
              }}
              style={{
                flex: 1,
                padding: '8px 14px',
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
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: newName.trim() && !isCreating ? '#3b82f6' : '#d1d5db',
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: newName.trim() && !isCreating ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {isCreating ? 'Creating…' : 'Create & Assign'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div style={{ padding: '0 16px 8px' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'rgba(0,0,0,0.03)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'
              }}
            />
          </div>

          {/* Project list */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '0 12px',
            }}
          >
            {filteredProjects.length === 0 && (
              <div
                style={{
                  padding: '20px 8px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: '#9ca3af',
                }}
              >
                {search ? 'No projects match your search' : 'No projects available'}
              </div>
            )}
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelect(project.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 10px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Color dot */}
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: project.color || '#6b7280',
                    flexShrink: 0,
                  }}
                />

                {/* Icon */}
                <span style={{ fontSize: 18, flexShrink: 0 }}>{project.icon || '📋'}</span>

                {/* Name & description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1f2937',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {project.name}
                  </div>
                  {project.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 1,
                      }}
                    >
                      {project.description}
                    </div>
                  )}
                </div>

                {/* Folder indicator */}
                {project.folder_path && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#059669',
                      background: '#ecfdf5',
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                    title={project.folder_path}
                  >
                    📂
                  </span>
                )}

                {/* Status badge */}
                {project.status === 'paused' && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#a16207',
                      background: '#fef9c3',
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    Paused
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Create new project button */}
          <div
            style={{
              padding: '8px 12px 12px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px dashed rgba(0,0,0,0.15)',
                background: 'transparent',
                color: '#3b82f6',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              + Create New Project
            </button>
          </div>
        </>
      )}

      {/* Animation */}
      <style>{`
        @keyframes pickerFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
