/**
 * ProjectManagerModal — Full CRUD for projects in Zen Mode.
 * Create, view details, edit, and delete projects with proper warnings.
 */
import { useState, useEffect, useCallback } from 'react'
import { useProjects, type Project, type ProjectOverview } from '@/hooks/useProjects'
import { API_BASE } from '@/lib/api'

// ── Types ────────────────────────────────────────────────────

interface ProjectManagerModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  /** Pre-select a project for viewing/editing */
  readonly initialProjectId?: string | null
  readonly onProjectSelect?: (projectId: string, projectName: string, projectColor?: string) => void
}

type ModalView = 'list' | 'create' | 'edit' | 'details' | 'delete-confirm'

interface ProjectForm {
  name: string
  description: string
  icon: string
  color: string
}

// ── Color & Icon Pickers ─────────────────────────────────────

const PROJECT_COLORS = [
  '#7aa2f7',
  '#9ece6a',
  '#e0af68',
  '#f7768e',
  '#bb9af7',
  '#7dcfff',
  '#ff9e64',
  '#73daca',
  '#c0caf5',
  '#db4b4b',
  '#449dab',
  '#6b7280',
  '#e879f9',
  '#34d399',
  '#fbbf24',
]

const PROJECT_ICONS = [
  '📋',
  '🚀',
  '💡',
  '🔧',
  '🎯',
  '📦',
  '🌐',
  '🔬',
  '📊',
  '🎨',
  '⚡',
  '🏗️',
  '📱',
  '🤖',
  '🔒',
  '📝',
]

const EMPTY_FORM: ProjectForm = { name: '', description: '', icon: '📋', color: '#7aa2f7' }

// ── Room info for delete warning ─────────────────────────────

interface RoomInfo {
  id: string
  name: string
}

// ── Component ────────────────────────────────────────────────

export function ProjectManagerModal({
  isOpen,
  onClose,
  initialProjectId,
  onProjectSelect,
}: ProjectManagerModalProps) {
  const { projects, createProject, updateProject, deleteProject, fetchOverview } = useProjects()
  const [view, setView] = useState<ModalView>('list')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [overview, setOverview] = useState<ProjectOverview[]>([])
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteRooms, setDeleteRooms] = useState<RoomInfo[]>([])

  // Load overview data
  useEffect(() => {
    if (!isOpen) return
    fetchOverview().then((r) => {
      if (r.success) setOverview(r.projects)
    })
  }, [isOpen, fetchOverview, projects])

  // Handle initial project selection
  useEffect(() => {
    if (isOpen && initialProjectId) {
      const p = projects.find((pr) => pr.id === initialProjectId)
      if (p) {
        setSelectedProject(p)
        setView('details')
      }
    } else if (isOpen) {
      setView('list')
      setSelectedProject(null)
    }
  }, [isOpen, initialProjectId, projects])

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM)
    setError(null)
  }, [])

  const openCreate = useCallback(() => {
    resetForm()
    setView('create')
  }, [resetForm])

  const openEdit = useCallback((project: Project) => {
    setForm({
      name: project.name,
      description: project.description || '',
      icon: project.icon || '📋',
      color: project.color || '#7aa2f7',
    })
    setSelectedProject(project)
    setError(null)
    setView('edit')
  }, [])

  const openDetails = useCallback((project: Project) => {
    setSelectedProject(project)
    setView('details')
  }, [])

  const openDeleteConfirm = useCallback(async (project: Project) => {
    setSelectedProject(project)
    // Fetch rooms assigned to this project
    try {
      const resp = await fetch(`${API_BASE}/projects/${project.id}`)
      if (resp.ok) {
        const data = await resp.json()
        const roomIds: string[] = data.rooms || []
        // Fetch room names
        if (roomIds.length > 0) {
          const roomsResp = await fetch(`${API_BASE}/rooms`)
          if (roomsResp.ok) {
            const roomsData = await roomsResp.json()
            const allRooms: RoomInfo[] = roomsData.rooms || []
            setDeleteRooms(allRooms.filter((r: RoomInfo) => roomIds.includes(r.id)))
          }
        } else {
          setDeleteRooms([])
        }
      }
    } catch {
      setDeleteRooms([])
    }
    setView('delete-confirm')
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    const result = await createProject({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      icon: form.icon,
      color: form.color,
    })
    setSaving(false)
    if (result.success) {
      setView('list')
      resetForm()
    } else {
      setError(result.error)
    }
  }, [form, createProject, resetForm])

  const handleUpdate = useCallback(async () => {
    if (!selectedProject || !form.name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    const result = await updateProject(selectedProject.id, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      icon: form.icon,
      color: form.color,
    })
    setSaving(false)
    if (result.success) {
      setView('list')
      resetForm()
    } else {
      setError(result.error)
    }
  }, [selectedProject, form, updateProject, resetForm])

  const handleDelete = useCallback(async () => {
    if (!selectedProject) return
    setSaving(true)
    setError(null)

    // First archive if not already archived (backend requires archived status)
    if (selectedProject.status !== 'archived') {
      // Need to unassign rooms first so archive succeeds
      for (const room of deleteRooms) {
        try {
          await fetch(`${API_BASE}/rooms/${room.id}/project`, { method: 'DELETE' })
        } catch {
          /* ignore */
        }
      }
      const archiveResult = await updateProject(selectedProject.id, { status: 'archived' })
      if (!archiveResult.success) {
        setSaving(false)
        setError(archiveResult.error)
        return
      }
    }

    const result = await deleteProject(selectedProject.id)
    setSaving(false)
    if (result.success) {
      setView('list')
      setSelectedProject(null)
    } else {
      setError(result.error)
    }
  }, [selectedProject, deleteProject, updateProject, deleteRooms])

  if (!isOpen) return null

  // ── Styles ─────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const modalStyle: React.CSSProperties = {
    background: 'var(--zen-bg-panel, #1a1b26)',
    color: 'var(--zen-fg, #c0caf5)',
    borderRadius: 12,
    border: '1px solid var(--zen-border, #3b4261)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
    width: '90vw',
    maxWidth: 520,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid var(--zen-border, #3b4261)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const bodyStyle: React.CSSProperties = {
    padding: '16px 20px',
    overflow: 'auto',
    flex: 1,
  }

  const btnStyle = (variant: 'primary' | 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    background: (() => {
      if (variant === 'primary') return 'var(--zen-accent, #7aa2f7)'
      if (variant === 'danger') return '#dc2626'
      return 'transparent'
    })(),
    color: variant === 'primary' || variant === 'danger' ? '#fff' : 'var(--zen-fg, #c0caf5)',
    opacity: saving ? 0.6 : 1,
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--zen-border, #3b4261)',
    background: 'var(--zen-bg-hover, #24283b)',
    color: 'var(--zen-fg, #c0caf5)',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--zen-fg-muted, #565f89)',
    marginBottom: 6,
    display: 'block',
  }

  // ── Render ─────────────────────────────────────────────────

  const renderHeader = (title: string, showBack = false) => (
    <div style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showBack && (
          <button
            onClick={() => setView('list')}
            style={{ ...btnStyle('ghost'), padding: '4px 8px' }}
          >
            ←
          </button>
        )}
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      </div>
      <button onClick={onClose} style={{ ...btnStyle('ghost'), padding: '4px 8px', fontSize: 16 }}>
        ✕
      </button>
    </div>
  )

  const renderForm = (isEdit: boolean) => (
    <div style={bodyStyle}>
      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 6,
            background: '#dc262620',
            color: '#f87171',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Name *</label>
        <input
          style={inputStyle}
          value={form.name}
          placeholder="Project name..."
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Description</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.description}
          placeholder="Optional description..."
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROJECT_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => setForm((f) => ({ ...f, icon }))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  form.icon === icon
                    ? 'var(--zen-accent, #7aa2f7)30'
                    : 'var(--zen-bg-hover, #24283b)',
                outline: form.icon === icon ? '2px solid var(--zen-accent, #7aa2f7)' : 'none',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setForm((f) => ({ ...f, color }))}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: color,
                outline: form.color === color ? '2px solid var(--zen-fg, #c0caf5)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => {
            setView('list')
            resetForm()
          }}
          style={btnStyle('ghost')}
        >
          Cancel
        </button>
        <button
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={saving}
          style={btnStyle('primary')}
        >
          {(() => {
            if (saving) return 'Saving...'
            if (isEdit) return 'Save Changes'
            return 'Create Project'
          })()}
        </button>
      </div>
    </div>
  )

  const renderList = () => {
    const activeProjects = projects.filter((p) => p.status === 'active')
    return (
      <div style={bodyStyle}>
        <button
          onClick={openCreate}
          style={{
            ...btnStyle('primary'),
            width: '100%',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          ＋ New Project
        </button>

        {activeProjects.length === 0 ? (
          <div
            style={{ textAlign: 'center', color: 'var(--zen-fg-muted)', fontSize: 13, padding: 24 }}
          >
            No projects yet. Create one to get started!
          </div>
        ) : (
          activeProjects.map((project) => {
            const ov = overview.find((o) => o.id === project.id)
            return (
              <div
                key={project.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  border: '1px solid var(--zen-border, #3b4261)',
                  transition: 'background 0.1s',
                }}
                onClick={() => openDetails(project)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--zen-bg-hover, #24283b)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: project.color || '#6b7280',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 16, flexShrink: 0 }}>{project.icon || '📋'}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
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
                        color: 'var(--zen-fg-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {project.description}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--zen-fg-muted)',
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {ov ? `${ov.room_count} rooms` : ''}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  const renderDetails = () => {
    if (!selectedProject) return null
    const ov = overview.find((o) => o.id === selectedProject.id)
    const created = new Date(selectedProject.created_at).toLocaleDateString()
    return (
      <div style={bodyStyle}>
        {/* Header card */}
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            marginBottom: 16,
            background: (selectedProject.color || '#6b7280') + '15',
            border: `1px solid ${selectedProject.color || '#6b7280'}30`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>{selectedProject.icon || '📋'}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedProject.name}</div>
              {selectedProject.description && (
                <div style={{ fontSize: 12, color: 'var(--zen-fg-muted)', marginTop: 2 }}>
                  {selectedProject.description}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--zen-fg-muted)' }}>
            <span>📅 Created {created}</span>
            {ov && <span>🏠 {ov.room_count} rooms</span>}
            {ov && <span>🤖 {ov.agent_count} agents</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onProjectSelect && (
            <button
              onClick={() => {
                onProjectSelect(
                  selectedProject.id,
                  selectedProject.name,
                  selectedProject.color || undefined
                )
                onClose()
              }}
              style={btnStyle('primary')}
            >
              🎯 Focus on this project
            </button>
          )}
          <button onClick={() => openEdit(selectedProject)} style={btnStyle('ghost')}>
            ✏️ Edit
          </button>
          <button
            onClick={() => openDeleteConfirm(selectedProject)}
            style={{ ...btnStyle('danger'), marginLeft: 'auto' }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    )
  }

  const renderDeleteConfirm = () => {
    if (!selectedProject) return null
    const maxShow = 5
    const shownRooms = deleteRooms.slice(0, maxShow)
    const moreCount = deleteRooms.length - maxShow
    return (
      <div style={bodyStyle}>
        {error && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 6,
              background: '#dc262620',
              color: '#f87171',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>
            Delete "{selectedProject.name}"?
          </div>
        </div>

        {deleteRooms.length > 0 && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              background: '#f59e0b15',
              border: '1px solid #f59e0b30',
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              This project is assigned to {deleteRooms.length} room
              {deleteRooms.length !== 1 ? 's' : ''}:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {shownRooms.map((r) => (
                <li key={r.id}>{r.name}</li>
              ))}
              {moreCount > 0 && (
                <li style={{ color: 'var(--zen-fg-muted)' }}>and {moreCount} more...</li>
              )}
            </ul>
          </div>
        )}

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            background: 'var(--zen-bg-hover, #24283b)',
            fontSize: 12,
            color: 'var(--zen-fg-muted)',
          }}
        >
          All room assignments will be removed. Documents will remain.
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setView('details')} style={btnStyle('ghost')}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={saving} style={btnStyle('danger')}>
            {saving ? 'Deleting...' : '🗑️ Delete Project'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {view === 'list' && renderHeader('Manage Projects')}
        {view === 'create' && renderHeader('New Project', true)}
        {view === 'edit' && renderHeader('Edit Project', true)}
        {view === 'details' && renderHeader('Project Details', true)}
        {view === 'delete-confirm' && renderHeader('Delete Project', true)}

        {view === 'list' && renderList()}
        {view === 'create' && renderForm(false)}
        {view === 'edit' && renderForm(true)}
        {view === 'details' && renderDetails()}
        {view === 'delete-confirm' && renderDeleteConfirm()}
      </div>
    </div>
  )
}
