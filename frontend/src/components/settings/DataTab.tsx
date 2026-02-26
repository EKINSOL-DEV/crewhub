import { useState, useEffect, useCallback, useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  Upload,
  Database,
  Loader2,
  Clock,
  HardDrive,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Check,
} from 'lucide-react'
import {
  exportBackup,
  importBackup,
  createBackup,
  listBackups,
  type BackupInfo,
  getSettings as apiGetSettings,
  updateSetting as apiUpdateSetting,
} from '@/lib/api'
import { Section, CollapsibleSection } from './shared'

const CLS_GAP_15_H_10 = 'gap-1.5 h-10'
const CLS_H_35_W_35 = 'h-3.5 w-3.5'
const CLS_H_35_W_35_ANIMATE_SPIN = 'h-3.5 w-3.5 animate-spin'
const PROJECTS = '~/Projects'

// ─── DataTab ─────────────────────────────────────────────────────────────────

export function DataTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <ProjectsBasePathSection />
      <BackupSection />
    </div>
  )
}

// ─── Projects Base Path Section ───────────────────────────────────────────────

function ProjectsBasePathSection() {
  const [basePath, setBasePath] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await apiGetSettings()
        const val = settings['projects_base_path'] || PROJECTS
        setBasePath(val)
        setSavedPath(val)
      } catch {
        setBasePath(PROJECTS)
        setSavedPath(PROJECTS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    const trimmed = basePath.trim()
    if (!trimmed) {
      setError('Path cannot be empty')
      return
    }
    if (!trimmed.startsWith('/') && !trimmed.startsWith('~')) {
      setError('Path must start with / or ~')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await apiUpdateSetting('projects_base_path', trimmed)
      setSavedPath(trimmed)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to save setting')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = basePath.trim() !== savedPath

  return (
    <Section title="📂 Projects Base Path">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="projects-base-path" className="text-sm font-medium">
            Base folder for project files
          </Label>
          <p className="text-xs text-muted-foreground">
            New projects will auto-generate folder paths under this directory.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="projects-base-path"
              value={basePath}
              onChange={(e) => {
                setBasePath(e.target.value)
                setError(null)
                setSuccess(false)
              }}
              placeholder={PROJECTS}
              className="pl-9 font-mono text-sm"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isDirty) handleSave()
              }}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
            size="sm"
            className="h-10 px-4"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className={CLS_H_35_W_35} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <Check className={CLS_H_35_W_35} />
            Projects base path saved
          </div>
        )}
      </div>
    </Section>
  )
}

// ─── Backup Section ───────────────────────────────────────────────────────────

function BackupSection() {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null
  )
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = importDialogRef.current
    if (!dialog) return
    if (showImportConfirm) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [showImportConfirm])

  const loadBackups = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listBackups()
      setBackups(list)
    } catch {
      setBackups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportBackup()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crewhub-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Export failed',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    pendingFileRef.current = file
    setShowImportConfirm(true)
    e.target.value = ''
  }

  const handleImportConfirmed = async () => {
    const file = pendingFileRef.current
    if (!file) return
    setShowImportConfirm(false)
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importBackup(file)
      setImportResult({
        success: result.success,
        message: result.message || 'Backup imported successfully',
      })
      await loadBackups()
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : 'Import failed',
      })
    } finally {
      setImporting(false)
      pendingFileRef.current = null
    }
  }

  const handleCreateSnapshot = async () => {
    setCreating(true)
    try {
      await createBackup()
      await loadBackups()
    } catch {
      // Best-effort
    } finally {
      setCreating(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <>
      <CollapsibleSection title="💾 Data & Backup" defaultOpen={false}>
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className={CLS_GAP_15_H_10}
            >
              {exporting ? (
                <Loader2 className={CLS_H_35_W_35_ANIMATE_SPIN} />
              ) : (
                <Download className={CLS_H_35_W_35} />
              )}
              <span className="text-xs">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={CLS_GAP_15_H_10}
            >
              {importing ? (
                <Loader2 className={CLS_H_35_W_35_ANIMATE_SPIN} />
              ) : (
                <Upload className={CLS_H_35_W_35} />
              )}
              <span className="text-xs">Import</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className={CLS_GAP_15_H_10}
            >
              {creating ? (
                <Loader2 className={CLS_H_35_W_35_ANIMATE_SPIN} />
              ) : (
                <Database className={CLS_H_35_W_35} />
              )}
              <span className="text-xs">Snapshot</span>
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Result message */}
          {importResult && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                importResult.success
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              {importResult.success ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {importResult.message}
            </div>
          )}

          {/* Backup history */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Backup History
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadBackups}
                disabled={loading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loading && backups.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">Loading…</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">No backups yet</div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {backups.map((backup, i) => (
                  <div
                    key={`backup-${i}`}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm"
                  >
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-medium">{backup.filename}</div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{formatSize(backup.size)}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDate(backup.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Import confirmation dialog */}
      <dialog // NOSONAR: <dialog> is a native interactive HTML element
        ref={importDialogRef}
        onClose={() => setShowImportConfirm(false)}
        onClick={(e) => e.target === e.currentTarget && setShowImportConfirm(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) = role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}> e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Import Backup?</h2>
            <div className="flex items-start gap-2 mt-2">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Warning:</strong> This will replace all current
                data including connections, rooms, routing rules, and settings. This action cannot
                be undone.
              </p>
            </div>
          </div>
          {pendingFileRef.current && (
            <div className="px-6 pb-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                File: <span className="font-mono">{pendingFileRef.current.name}</span>
                <span className="text-muted-foreground ml-2">
                  ({formatSize(pendingFileRef.current.size)})
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportConfirm(false)
                pendingFileRef.current = null
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleImportConfirmed}>
              Replace & Import
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
