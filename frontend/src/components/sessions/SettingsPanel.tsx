import { useState, useEffect, useCallback, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGridDebug } from "@/hooks/useGridDebug"
import { useDebugBots } from "@/hooks/useDebugBots"
import { useLightingPanelVisibility } from "@/hooks/useLightingConfig"
import {
  X, Download, Upload, Database, Loader2, Clock,
  HardDrive, RefreshCw, FolderOpen, AlertCircle, Check,
  Palette, LayoutGrid, SlidersHorizontal, Wrench, FolderKanban, Cable, Bot, Shield,
} from "lucide-react"
import { ConnectionsView } from "./ConnectionsView"
import {
  exportBackup,
  importBackup,
  createBackup,
  listBackups,
  type BackupInfo,
  getSettings as apiGetSettings,
  updateSetting as apiUpdateSetting,
} from "@/lib/api"
import { AgentsSettingsTab } from "./AgentsSettingsTab"
import { PersonasTab } from "@/components/persona/PersonasTab"
import { IdentityTab } from "@/components/persona/IdentityTab"

// ─── Extracted tab components ─────────────────────────────────────────────────
import { LookAndFeelTab } from "@/components/settings/LookAndFeelTab"
import { RoomsTab } from "@/components/settings/RoomsTab"
import { ProjectsTab } from "@/components/settings/ProjectsTab"
import { BehaviorTab } from "@/components/settings/BehaviorTab"
import { Section, CollapsibleSection } from "@/components/settings/shared"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionsSettings {
  refreshInterval: number
  autoRefresh: boolean
  showAnimations: boolean
  playSound: boolean
  displayDensity: "compact" | "comfortable"
  showBadges: boolean
  easterEggsEnabled: boolean
  playgroundSpeed: number
  parkingIdleThreshold: number
}

export type MinionsSettings = SessionsSettings

const DEFAULT_SETTINGS: SessionsSettings = {
  refreshInterval: 5000,
  autoRefresh: true,
  showAnimations: true,
  playSound: false,
  displayDensity: "comfortable",
  showBadges: true,
  easterEggsEnabled: true,
  playgroundSpeed: 1.0,
  parkingIdleThreshold: 120,
}

interface SettingsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: SessionsSettings
  onSettingsChange: (settings: SessionsSettings) => void
  /** Active sessions for testing routing rules */
  sessions?: import("@/lib/api").CrewSession[]
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type SettingsTab = "look" | "rooms" | "projects" | "agents" | "personas" | "identity" | "behavior" | "data" | "connections" | "advanced"

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "look", label: "Look & Feel", icon: <Palette className="h-4 w-4" /> },
  { id: "rooms", label: "Rooms", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
  { id: "agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
  { id: "personas", label: "Personas", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: "identity", label: "Identity", icon: <Shield className="h-4 w-4" /> },
  { id: "behavior", label: "Behavior", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: "data", label: "Data", icon: <Database className="h-4 w-4" /> },
  { id: "connections", label: "Connections", icon: <Cable className="h-4 w-4" /> },
  { id: "advanced", label: "Advanced", icon: <Wrench className="h-4 w-4" /> },
]

const SETTINGS_TAB_STORAGE_KEY = "crewhub-settings-tab"

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPanel({ open, onOpenChange, settings, onSettingsChange, sessions: activeSessions }: SettingsPanelProps) {
  const [gridDebugEnabled, toggleGridDebug] = useGridDebug()
  const { debugBotsEnabled, setDebugBotsEnabled } = useDebugBots()
  const { visible: lightingPanelVisible, setVisible: setLightingPanelVisible } = useLightingPanelVisibility()

  // ─── Tab state (persisted in localStorage) ───
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(() => {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
    if (stored && SETTINGS_TABS.some(t => t.id === stored)) return stored as SettingsTab
    return "look"
  })

  // Re-read tab from localStorage when panel opens (e.g. from "Open Connections" button)
  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
      if (stored && SETTINGS_TABS.some(t => t.id === stored)) {
        setSelectedTab(stored as SettingsTab)
      }
    }
  }, [open])

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setSelectedTab(tab)
    localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab)
  }, [])

  // ─── Track modals in child tabs (to guard Escape key) ───
  const [roomsHasModal, setRoomsHasModal] = useState(false)

  // ─── Escape key ───
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !roomsHasModal) {
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange, roomsHasModal])

  // ─── Early return ───
  if (!open) return null

  return (
    <>
      {/* ─── Fullscreen overlay ─── */}
      <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />

        {/* Fullscreen content area */}
        <div className="relative z-10 h-full flex flex-col bg-background/95 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300">
          {/* ─── Sticky Header + Tabs ─── */}
          <div className="flex-shrink-0 max-w-[1400px] w-full mx-auto px-8 pt-8">

            {/* ─── Header ─── */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">⚙️ Crew Settings</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Customize how the Crew behaves and looks
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2.5 rounded-xl border bg-card hover:bg-accent transition-colors shadow-sm"
                title="Close settings"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ─── Tab Bar ─── */}
            <div className="flex gap-1 border-b border-border">
              {SETTINGS_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors -mb-px
                    ${selectedTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Scrollable Tab Content ─── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-8 py-8 pb-16">

              {/* ═══ Tab: Look & Feel ═══ */}
              {selectedTab === "look" && (
                <LookAndFeelTab settings={settings} onSettingsChange={onSettingsChange} />
              )}

              {/* ═══ Tab: Rooms ═══ */}
              {selectedTab === "rooms" && (
                <RoomsTab sessions={activeSessions} onModalStateChange={setRoomsHasModal} />
              )}

              {/* ═══ Tab: Projects ═══ */}
              {selectedTab === "projects" && (
                <ProjectsTab />
              )}

              {/* ═══ Tab: Agents ═══ */}
              {selectedTab === "agents" && (
                <AgentsSettingsTab />
              )}

              {/* ═══ Tab: Personas ═══ */}
              {selectedTab === "personas" && (
                <PersonasTab />
              )}

              {/* ═══ Tab: Identity ═══ */}
              {selectedTab === "identity" && (
                <IdentityTab />
              )}

              {/* ═══ Tab: Behavior ═══ */}
              {selectedTab === "behavior" && (
                <BehaviorTab settings={settings} onSettingsChange={onSettingsChange} />
              )}

              {/* ═══ Tab: Data ═══ */}
              {selectedTab === "data" && (
                <div className="max-w-2xl space-y-6">
                  <ProjectsBasePathSection />
                  <BackupSection />
                </div>
              )}

              {/* ═══ Tab: Connections ═══ */}
              {selectedTab === "connections" && (
                <ConnectionsView embedded />
              )}

              {/* ═══ Tab: Advanced ═══ */}
              {selectedTab === "advanced" && (
                <div className="max-w-2xl">
                  <Section title="🔧 Developer">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="grid-debug" className="flex flex-col gap-1">
                        <span className="text-sm">Grid Overlay</span>
                        <span className="text-xs text-muted-foreground font-normal">Show 20×20 grid debug overlay on rooms</span>
                      </Label>
                      <Switch
                        id="grid-debug"
                        checked={gridDebugEnabled}
                        onCheckedChange={(checked) => toggleGridDebug(checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="lighting-editor" className="flex flex-col gap-1">
                        <span className="text-sm">💡 Lighting Editor</span>
                        <span className="text-xs text-muted-foreground font-normal">Live lighting debug panel with sliders &amp; JSON export</span>
                      </Label>
                      <Switch
                        id="lighting-editor"
                        checked={lightingPanelVisible}
                        onCheckedChange={(checked) => setLightingPanelVisible(checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="debug-bots" className="flex flex-col gap-1">
                        <span className="text-sm">🧪 Debug Bots</span>
                        <span className="text-xs text-muted-foreground font-normal">Add fake test bots to rooms for visual testing</span>
                      </Label>
                      <Switch
                        id="debug-bots"
                        checked={debugBotsEnabled}
                        onCheckedChange={(checked) => setDebugBotsEnabled(checked)}
                      />
                    </div>
                  </Section>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Projects Base Path Section ───────────────────────────────────────────────

function ProjectsBasePathSection() {
  const [basePath, setBasePath] = useState("")
  const [savedPath, setSavedPath] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await apiGetSettings()
        const val = settings["projects_base_path"] || "~/Projects"
        setBasePath(val)
        setSavedPath(val)
      } catch {
        setBasePath("~/Projects")
        setSavedPath("~/Projects")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    const trimmed = basePath.trim()
    if (!trimmed) {
      setError("Path cannot be empty")
      return
    }
    if (!trimmed.startsWith("/") && !trimmed.startsWith("~")) {
      setError("Path must start with / or ~")
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await apiUpdateSetting("projects_base_path", trimmed)
      setSavedPath(trimmed)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError("Failed to save setting")
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
              onChange={(e) => { setBasePath(e.target.value); setError(null); setSuccess(false) }}
              placeholder="~/Projects"
              className="pl-9 font-mono text-sm"
              disabled={loading}
              onKeyDown={(e) => { if (e.key === "Enter" && isDirty) handleSave() }}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
            size="sm"
            className="h-10 px-4"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <Check className="h-3.5 w-3.5" />
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
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)

  const importDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = importDialogRef.current
    if (!dialog) return
    if (showImportConfirm) { if (!dialog.open) dialog.showModal() }
    else { if (dialog.open) dialog.close() }
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
      const a = document.createElement("a")
      a.href = url
      a.download = `crewhub-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : "Export failed",
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
    e.target.value = ""
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
        message: result.message || "Backup imported successfully",
      })
      await loadBackups()
    } catch (err) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : "Import failed",
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
              className="gap-1.5 h-10"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="text-xs">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5 h-10"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <span className="text-xs">Import</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="gap-1.5 h-10"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
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
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              }`}
            >
              {importResult.success
                ? <Check className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />
              }
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
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
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
                    key={i}
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
      <dialog
        ref={importDialogRef}
        onClose={() => setShowImportConfirm(false)}
        onClick={(e) => e.target === e.currentTarget && setShowImportConfirm(false)}
        className="backdrop:bg-black/50 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none open:flex items-center justify-center fixed inset-0 z-[80]"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden"
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-semibold">Import Backup?</h2>
            <div className="flex items-start gap-2 mt-2">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Warning:</strong> This will replace all current data
                including connections, rooms, routing rules, and settings.
                This action cannot be undone.
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

export { DEFAULT_SETTINGS }
