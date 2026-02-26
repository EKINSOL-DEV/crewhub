import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  X,
  Check,
  Edit2,
  Loader2,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react'
import { useProjects, type Project } from '@/hooks/useProjects'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useToast } from '@/hooks/use-toast'
import { CollapsibleSection } from './shared'

// ─── Projects Settings Section ────────────────────────────────────────────────

interface ProjectsSettingsSectionProps {
  readonly projects: Project[]
  readonly rooms: Room[]
  readonly isLoading: boolean
  readonly onArchive: (id: string) => Promise<{ success: boolean; error?: string }>
  readonly onUnarchive: (id: string) => Promise<{ success: boolean; error?: string }>
  readonly onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  readonly onUpdate: (
    id: string,
    updates: {
      name?: string
      description?: string
      icon?: string
      color?: string
      status?: string
      folder_path?: string
    }
  ) => Promise<{ success: boolean; error?: string }>
}

function ProjectsSettingsSection({
  projects,
  rooms,
  isLoading,
  onArchive,
  onUnarchive,
  onDelete,
  onUpdate,
}: ProjectsSettingsSectionProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const deleteDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = deleteDialogRef.current
    if (!dialog) return
    if (deleteConfirm) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [deleteConfirm])

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.status === 'archived' && b.status !== 'archived') return 1
    if (a.status !== 'archived' && b.status === 'archived') return -1
    return b.created_at - a.created_at
  })

  const getAssignedRoomCount = (projectId: string) =>
    rooms.filter((r) => r.project_id === projectId).length

  const getAssignedRoomNames = (projectId: string) =>
    rooms.filter((r) => r.project_id === projectId).map((r) => `${r.icon || '🏠'} ${r.name}`)

  const handleArchive = async (projectId: string) => {
    setArchiveError(null)
    const result = await onArchive(projectId)
    if (!result.success && result.error) {
      setArchiveError(result.error)
    }
  }

  const handleStartEdit = (project: Project) => {
    setEditingId(project.id)
    setEditName(project.name)
  }

  const handleSaveEdit = async (projectId: string) => {
    if (editName.trim()) {
      await onUpdate(projectId, { name: editName.trim() })
    }
    setEditingId(null)
  }

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString()
    } catch {
      return '—'
    }
  }

  const projectToDelete = deleteConfirm ? projects.find((p) => p.id === deleteConfirm) : null

  return (
    <>
      <CollapsibleSection
        title="📋 All Projects"
        badge={`${projects.length} project${projects.length === 1 ? '' : 's'}`}
      >
        {/* Archive error banner */}
        {archiveError && (
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">{archiveError}</div>
            </div>
            <button
              onClick={() => setArchiveError(null)}
              className="ml-auto p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Loading projects…
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No projects yet. Create one from the 3D World view.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedProjects.map((project) => {
              const isArchived = project.status === 'archived'
              const roomCount = getAssignedRoomCount(project.id)
              const assignedRoomNames = getAssignedRoomNames(project.id)
              const isEditing = editingId === project.id

              return (
                <div
                  key={project.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isArchived
                      ? 'bg-muted/30 opacity-60 border-border/50'
                      : 'bg-background hover:bg-accent/20 border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Color dot + icon */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color || '#6b7280' }}
                      />
                      <span className="text-lg">{project.icon || '📋'}</span>
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(project.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <button
                            onClick={() => handleSaveEdit(project.id)}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{project.name}</span>
                            {isArchived && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                Archived
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>
                              {roomCount} room{roomCount === 1 ? '' : 's'}
                            </span>
                            {project.folder_path && (
                              <span className="truncate font-mono max-w-[200px]">
                                {project.folder_path}
                              </span>
                            )}
                            <span>Created {formatDate(project.created_at)}</span>
                          </div>
                          {roomCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {assignedRoomNames.map((name, i) => (
                                <span
                                  key={`name-${i}`}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(project)}
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Edit name"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {isArchived ? (
                          <button
                            onClick={() => onUnarchive(project.id)}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-muted-foreground hover:text-green-600"
                            title="Unarchive — restore to active"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(project.id)}
                            className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded text-muted-foreground hover:text-amber-600"
                            title={
                              roomCount > 0 ? 'Remove from all rooms first' : 'Archive project'
                            }
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {isArchived && (
                          <button
                            onClick={() => setDeleteConfirm(project.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                            title="Delete project permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Delete confirmation dialog */}
      <dialog
        ref={deleteDialogRef}
        onClose={() => setDeleteConfirm(null)}
        onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Delete Project?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Delete project <strong>"{projectToDelete?.name}"</strong>? This action cannot be
              undone.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will NOT delete any files on disk.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirm) {
                  await onDelete(deleteConfirm)
                  setDeleteConfirm(null)
                }
              }}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}

// ─── ProjectsTab ──────────────────────────────────────────────────────────────

export function ProjectsTab() {
  const {
    projects,
    isLoading: projectsLoading,
    updateProject,
    deleteProject: deleteProjectApi,
  } = useProjects()
  const { rooms } = useRooms()
  const { toast } = useToast()

  return (
    <div className="max-w-4xl">
      <ProjectsSettingsSection
        projects={projects}
        rooms={rooms}
        isLoading={projectsLoading}
        onArchive={async (projectId) => {
          const result = await updateProject(projectId, { status: 'archived' })
          if (result.success) {
            toast({ title: 'Project Archived', description: 'Project has been archived' })
          } else {
            toast({ title: 'Cannot Archive', description: result.error, variant: 'destructive' })
          }
          return result
        }}
        onUnarchive={async (projectId) => {
          const result = await updateProject(projectId, { status: 'active' })
          if (result.success) {
            toast({ title: 'Project Restored', description: 'Project is now active again' })
          } else {
            toast({
              title: 'Failed to Unarchive',
              description: result.error,
              variant: 'destructive',
            })
          }
          return result
        }}
        onDelete={async (projectId) => {
          const result = await deleteProjectApi(projectId)
          if (result.success) {
            toast({ title: 'Project Deleted', description: 'Project has been permanently deleted' })
          } else {
            toast({ title: 'Failed to Delete', description: result.error, variant: 'destructive' })
          }
          return result
        }}
        onUpdate={async (projectId, updates) => {
          const result = await updateProject(projectId, updates)
          if (result.success) {
            toast({ title: 'Project Updated' })
          } else {
            toast({ title: 'Failed to Update', description: result.error, variant: 'destructive' })
          }
          return result
        }}
      />
    </div>
  )
}
