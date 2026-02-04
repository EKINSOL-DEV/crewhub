import { useState, useEffect, useCallback, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme, accentColors, type ThemeMode, type AccentColor } from "@/contexts/ThemeContext"
import { useGridDebug } from "@/hooks/useGridDebug"
import { useDebugBots } from "@/hooks/useDebugBots"
import { useLightingPanelVisibility } from "@/hooks/useLightingConfig"
import { useEnvironment, type EnvironmentType } from "@/components/world3d/environments"
import { useSessionConfig } from "@/hooks/useSessionConfig"
import {
  SESSION_CONFIG_DEFAULTS,
  updateConfig,
  resetConfig,
  isOverridden,
  getOverrideCount,
  type SessionConfigKey,
} from "@/lib/sessionConfig"
import {
  Sun, Moon, Monitor, X, Plus, Trash2, Edit2, Check,
  ChevronUp, ChevronDown, ChevronRight,
  AlertCircle, Download, Upload, Database, Loader2, Clock,
  HardDrive, RefreshCw, FolderOpen,
  Palette, LayoutGrid, SlidersHorizontal, Wrench, FolderKanban, Archive, ArchiveRestore,
} from "lucide-react"
import {
  exportBackup,
  importBackup,
  createBackup,
  listBackups,
  type BackupInfo,
  getSettings as apiGetSettings,
  updateSetting as apiUpdateSetting,
} from "@/lib/api"
import { useRooms, type Room } from "@/hooks/useRooms"
import { useRoomAssignmentRules, type RoomAssignmentRule } from "@/hooks/useRoomAssignmentRules"
import { useProjects, type Project } from "@/hooks/useProjects"
import { useToast } from "@/hooks/use-toast"

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
}

// ─── Constants for room management ───────────────────────────────────────────

const ROOM_ICONS = ["🏛️", "💻", "🎨", "🧠", "⚙️", "📡", "🛠️", "📢", "🚀", "📊", "🔬", "📝", "🎯", "💡", "🔧", "📦"]
const ROOM_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#14b8a6", "#f97316", "#ec4899",
  "#3b82f6", "#ef4444", "#84cc16", "#a855f7", "#0ea5e9", "#f43f5e", "#22c55e", "#6366f1",
]

const RULE_TYPES = [
  { value: "session_key_contains", label: "Session Key Contains", description: "Match if session key includes text" },
  { value: "keyword", label: "Label Keyword", description: "Match if label contains keyword" },
  { value: "model", label: "Model Name", description: "Match if model includes text" },
  { value: "label_pattern", label: "Regex Pattern", description: "Match label with regex" },
  { value: "session_type", label: "Session Type", description: "Match by session type" },
] as const

const SESSION_TYPES = [
  { value: "main", label: "Main Session" },
  { value: "cron", label: "Cron Job" },
  { value: "subagent", label: "Subagent/Spawn" },
  { value: "slack", label: "Slack" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
]

// ─── Tab definitions ─────────────────────────────────────────────────────────

type SettingsTab = "look" | "rooms" | "projects" | "behavior" | "data" | "advanced"

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "look", label: "Look & Feel", icon: <Palette className="h-4 w-4" /> },
  { id: "rooms", label: "Rooms", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "projects", label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
  { id: "behavior", label: "Behavior", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: "data", label: "Data", icon: <Database className="h-4 w-4" /> },
  { id: "advanced", label: "Advanced", icon: <Wrench className="h-4 w-4" /> },
]

const SETTINGS_TAB_STORAGE_KEY = "crewhub-settings-tab"

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/80 p-6 space-y-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  )
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultOpen)
  return (
    <div className="rounded-xl border bg-card/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 pb-4 hover:bg-accent/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && <div className="px-6 pb-6 space-y-4">{children}</div>}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SettingsPanel({ open, onOpenChange, settings, onSettingsChange }: SettingsPanelProps) {
  const { theme, setTheme, resolvedMode } = useTheme()
  const { rooms, createRoom, updateRoom, deleteRoom, reorderRooms, isLoading: roomsLoading } = useRooms()
  const { rules, createRule, deleteRule, updateRule, isLoading: rulesLoading } = useRoomAssignmentRules()
  const {
    projects,
    isLoading: projectsLoading,
    updateProject,
    deleteProject: deleteProjectApi,
  } = useProjects()
  const { toast } = useToast()
  const [gridDebugEnabled, toggleGridDebug] = useGridDebug()
  const { debugBotsEnabled, setDebugBotsEnabled } = useDebugBots()
  const { visible: lightingPanelVisible, setVisible: setLightingPanelVisible } = useLightingPanelVisibility()
  const [environment, setEnvironment] = useEnvironment()
  const sessionConfig = useSessionConfig()
  const overrideCount = getOverrideCount()

  // ─── Tab state (persisted in localStorage) ───
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(() => {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
    if (stored && SETTINGS_TABS.some(t => t.id === stored)) return stored as SettingsTab
    return "look"
  })

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setSelectedTab(tab)
    localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab)
  }, [])

  // ─── Room management state ───
  const [showCreateRoomDialog, setShowCreateRoomDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState({ name: "", icon: "🏛️", color: "#4f46e5" })

  // ─── Routing rules state ───
  const [showCreateRuleDialog, setShowCreateRuleDialog] = useState(false)
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<string | null>(null)
  const [newRule, setNewRule] = useState({
    rule_type: "session_key_contains" as RoomAssignmentRule["rule_type"],
    rule_value: "",
    room_id: "",
    priority: 50,
  })

  // ─── Escape key ───
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !showCreateRoomDialog &&
        !deleteRoomConfirm &&
        !showCreateRuleDialog &&
        !deleteRuleConfirm
      ) {
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange, showCreateRoomDialog, deleteRoomConfirm, showCreateRuleDialog, deleteRuleConfirm])

  // ─── Helpers ───
  const updateSetting = <K extends keyof SessionsSettings>(key: K, value: SessionsSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const generateRoomId = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-room"

  // ─── Room handlers ───
  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) {
      toast({ title: "Name required", description: "Please enter a room name", variant: "destructive" })
      return
    }
    const roomId = generateRoomId(newRoom.name)
    const result = await createRoom({
      id: roomId,
      name: newRoom.name.trim(),
      icon: newRoom.icon,
      color: newRoom.color,
      sort_order: rooms.length,
    })
    if (result.success) {
      toast({ title: "Room Created!", description: `${newRoom.icon} ${newRoom.name} is ready` })
      setShowCreateRoomDialog(false)
      setNewRoom({ name: "", icon: "🏛️", color: "#4f46e5" })
    } else {
      toast({ title: "Failed to create room", description: result.error, variant: "destructive" })
    }
  }

  const handleUpdateRoom = async (room: Room) => {
    const result = await updateRoom(room.id, {
      name: room.name,
      icon: room.icon || undefined,
      color: room.color || undefined,
    })
    if (result.success) {
      toast({ title: "Room Updated!", description: `${room.icon} ${room.name} saved` })
      setEditingRoom(null)
    } else {
      toast({ title: "Failed to update room", description: result.error, variant: "destructive" })
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    const result = await deleteRoom(roomId)
    if (result.success) {
      toast({ title: "Room Deleted", description: `${room?.icon} ${room?.name} removed` })
      setDeleteRoomConfirm(null)
    } else {
      toast({ title: "Failed to delete room", description: result.error, variant: "destructive" })
    }
  }

  const moveRoom = async (roomId: string, direction: "up" | "down") => {
    const currentIndex = sortedRooms.findIndex(r => r.id === roomId)
    if (currentIndex === -1) return
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= rooms.length) return
    const newOrder = [...sortedRooms.map(r => r.id)]
    ;[newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]]
    await reorderRooms(newOrder)
  }

  // ─── Rule handlers ───
  const handleCreateRule = async () => {
    if (!newRule.rule_value.trim()) {
      toast({ title: "Value required", description: "Please enter a rule value", variant: "destructive" })
      return
    }
    if (!newRule.room_id) {
      toast({ title: "Room required", description: "Please select a target room", variant: "destructive" })
      return
    }
    const success = await createRule({
      rule_type: newRule.rule_type,
      rule_value: newRule.rule_value.trim(),
      room_id: newRule.room_id,
      priority: newRule.priority,
    })
    if (success) {
      toast({ title: "Rule Created!", description: "New routing rule is active" })
      setShowCreateRuleDialog(false)
      setNewRule({ rule_type: "session_key_contains", rule_value: "", room_id: rooms[0]?.id || "", priority: 50 })
    } else {
      toast({ title: "Failed to create rule", variant: "destructive" })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    const success = await deleteRule(ruleId)
    if (success) {
      toast({ title: "Rule Deleted" })
      setDeleteRuleConfirm(null)
    } else {
      toast({ title: "Failed to delete rule", variant: "destructive" })
    }
  }

  const adjustPriority = async (ruleId: string, delta: number) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    const newPriority = Math.max(0, Math.min(100, rule.priority + delta))
    await updateRule(ruleId, { priority: newPriority })
  }

  const getRuleTypeLabel = (type: string) =>
    RULE_TYPES.find(t => t.value === type)?.label || type

  const sortedRooms = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority)

  const themeModeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
  ]

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                <Section title="🎨 Appearance">
                  {/* Theme Mode */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Theme</Label>
                    <div className="flex gap-2">
                      {themeModeOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setTheme({ mode: option.value })}
                          className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all flex-1 justify-center
                            ${theme.mode === option.value
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border bg-background hover:bg-muted"
                            }
                          `}
                        >
                          {option.icon}
                          <span className="text-sm font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    {theme.mode === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Currently using {resolvedMode} mode based on your system preference
                      </p>
                    )}
                  </div>

                  {/* Accent Color — bigger swatches */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Accent Color</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {(Object.entries(accentColors) as [AccentColor, typeof accentColors[AccentColor]][]).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => setTheme({ accentColor: key })}
                          className={`
                            flex flex-col items-center gap-2 p-3 rounded-xl border transition-all
                            ${theme.accentColor === key
                              ? "border-2 border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                            }
                          `}
                          title={config.name}
                        >
                          <div
                            className="w-10 h-10 rounded-full shadow-md ring-2 ring-white/20"
                            style={{ backgroundColor: config.preview }}
                          />
                          <span className="text-xs text-muted-foreground font-medium">{config.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Section>

                <Section title="🌍 World Environment">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Environment Style</Label>
                    <div className="space-y-2">
                      {([
                        { value: 'grass' as EnvironmentType, label: '🌿 Classic Grass', desc: 'Flat grass field with tufts and rocks' },
                        { value: 'island' as EnvironmentType, label: '🏝️ Floating Island', desc: 'Monument Valley-style floating island' },
                        { value: 'floating' as EnvironmentType, label: '✨ Sky Platform', desc: 'Futuristic hexagonal floating platform' },
                      ]).map(option => (
                        <button
                          key={option.value}
                          onClick={() => setEnvironment(option.value)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left
                            ${environment === option.value
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border bg-background hover:bg-muted"
                            }
                          `}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.desc}</div>
                          </div>
                          {environment === option.value && (
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </Section>

                <div className="space-y-6">
                  <Section title="📺 Display">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-animations" className="flex flex-col gap-1">
                        <span className="text-sm">Animations</span>
                        <span className="text-xs text-muted-foreground font-normal">Show wiggle and bounce effects</span>
                      </Label>
                      <Switch
                        id="show-animations"
                        checked={settings.showAnimations}
                        onCheckedChange={(checked) => updateSetting("showAnimations", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-badges" className="flex flex-col gap-1">
                        <span className="text-sm">Achievement Badges</span>
                        <span className="text-xs text-muted-foreground font-normal">Display earned badges</span>
                      </Label>
                      <Switch
                        id="show-badges"
                        checked={settings.showBadges}
                        onCheckedChange={(checked) => updateSetting("showBadges", checked)}
                      />
                    </div>
                  </Section>

                  <Section title="🎉 Fun & Playfulness">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="easter-eggs" className="flex flex-col gap-1">
                        <span className="text-sm">Easter Eggs</span>
                        <span className="text-xs text-muted-foreground font-normal">Enable hidden surprises</span>
                      </Label>
                      <Switch
                        id="easter-eggs"
                        checked={settings.easterEggsEnabled}
                        onCheckedChange={(checked) => updateSetting("easterEggsEnabled", checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="play-sound" className="flex flex-col gap-1">
                        <span className="text-sm">Sound Effects</span>
                        <span className="text-xs text-muted-foreground font-normal">Play sounds for easter eggs</span>
                      </Label>
                      <Switch
                        id="play-sound"
                        checked={settings.playSound}
                        onCheckedChange={(checked) => updateSetting("playSound", checked)}
                        disabled={!settings.easterEggsEnabled}
                      />
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {/* ═══ Tab: Rooms ═══ */}
            {selectedTab === "rooms" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <CollapsibleSection
                  title="🏢 Room Management"
                  badge={`${rooms.length} rooms`}
                >
                  <Button
                    onClick={() => setShowCreateRoomDialog(true)}
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Room
                  </Button>

                  {roomsLoading ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading rooms…</div>
                  ) : sortedRooms.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No rooms yet. Create one to get started!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedRooms.map((room, index) => (
                        <div
                          key={room.id}
                          className="flex items-center gap-2 p-3 rounded-lg border bg-background hover:bg-accent/30 transition-colors"
                        >
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveRoom(room.id, "up")}
                              disabled={index === 0}
                              className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveRoom(room.id, "down")}
                              disabled={index === sortedRooms.length - 1}
                              className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Room icon */}
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                            style={{ backgroundColor: `${room.color}20`, border: `2px solid ${room.color}` }}
                          >
                            {room.icon}
                          </div>

                          {/* Name / edit */}
                          <div className="flex-1 min-w-0">
                            {editingRoom?.id === room.id ? (
                              <div className="flex gap-1.5">
                                <Input
                                  value={editingRoom.name}
                                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                                  className="h-8 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleUpdateRoom(editingRoom)
                                    if (e.key === "Escape") setEditingRoom(null)
                                  }}
                                />
                                <button
                                  onClick={() => handleUpdateRoom(editingRoom)}
                                  className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingRoom(null)}
                                  className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-sm truncate">{room.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{room.id}</div>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {editingRoom?.id !== room.id && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setEditingRoom({ ...room })}
                                className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteRoomConfirm(room.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleSection>

                <CollapsibleSection
                  title="🔀 Routing Rules"
                  badge={`${rules.length} rules`}
                >
                  <Button
                    onClick={() => {
                      setNewRule(r => ({ ...r, room_id: rooms[0]?.id || "" }))
                      setShowCreateRuleDialog(true)
                    }}
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rule
                  </Button>

                  <div className="p-3 rounded-lg bg-muted/50 text-xs flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-muted-foreground">
                      Rules are evaluated by priority (highest first). First match wins.
                    </p>
                  </div>

                  {rulesLoading ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">Loading rules…</div>
                  ) : sortedRules.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No rules yet. Sessions will use default routing.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sortedRules.map(rule => {
                        const room = rooms.find(r => r.id === rule.room_id)
                        return (
                          <div
                            key={rule.id}
                            className="p-3 rounded-lg border bg-background hover:bg-accent/20 transition-colors"
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Priority controls */}
                              <div className="flex flex-col items-center gap-0.5 shrink-0">
                                <button
                                  onClick={() => adjustPriority(rule.id, 10)}
                                  className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <Badge variant="secondary" className="text-[10px] font-mono px-1.5">
                                  {rule.priority}
                                </Badge>
                                <button
                                  onClick={() => adjustPriority(rule.id, -10)}
                                  className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Rule info */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className="text-[10px]">
                                    {getRuleTypeLabel(rule.rule_type)}
                                  </Badge>
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                    {rule.rule_value}
                                  </code>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span>→</span>
                                  {room && (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{
                                        backgroundColor: `${room.color || "#4f46e5"}20`,
                                        color: room.color || "#4f46e5",
                                        border: `1px solid ${room.color || "#4f46e5"}40`,
                                      }}
                                    >
                                      {room.icon} {room.name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Delete */}
                              <button
                                onClick={() => setDeleteRuleConfirm(rule.id)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-muted-foreground hover:text-red-600 shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            )}

            {/* ═══ Tab: Projects ═══ */}
            {selectedTab === "projects" && (
              <div className="max-w-4xl">
                <ProjectsSettingsSection
                  projects={projects}
                  rooms={rooms}
                  isLoading={projectsLoading}
                  onArchive={async (projectId) => {
                    const result = await updateProject(projectId, { status: "archived" })
                    if (result.success) {
                      toast({ title: "Project Archived", description: "Project has been archived" })
                    } else {
                      toast({ title: "Cannot Archive", description: result.error, variant: "destructive" })
                    }
                    return result
                  }}
                  onUnarchive={async (projectId) => {
                    const result = await updateProject(projectId, { status: "active" })
                    if (result.success) {
                      toast({ title: "Project Restored", description: "Project is now active again" })
                    } else {
                      toast({ title: "Failed to Unarchive", description: result.error, variant: "destructive" })
                    }
                    return result
                  }}
                  onDelete={async (projectId) => {
                    const result = await deleteProjectApi(projectId)
                    if (result.success) {
                      toast({ title: "Project Deleted", description: "Project has been permanently deleted" })
                    } else {
                      toast({ title: "Failed to Delete", description: result.error, variant: "destructive" })
                    }
                    return result
                  }}
                  onUpdate={async (projectId, updates) => {
                    const result = await updateProject(projectId, updates)
                    if (result.success) {
                      toast({ title: "Project Updated" })
                    } else {
                      toast({ title: "Failed to Update", description: result.error, variant: "destructive" })
                    }
                    return result
                  }}
                />
              </div>
            )}

            {/* ═══ Tab: Behavior ═══ */}
            {selectedTab === "behavior" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                <Section title="🔄 Updates">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-refresh" className="flex flex-col gap-1">
                      <span className="text-sm">Auto-refresh</span>
                      <span className="text-xs text-muted-foreground font-normal">Automatically update crew data</span>
                    </Label>
                    <Switch
                      id="auto-refresh"
                      checked={settings.autoRefresh}
                      onCheckedChange={(checked) => updateSetting("autoRefresh", checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="refresh-interval" className="text-sm">Refresh Interval</Label>
                    <Select
                      value={settings.refreshInterval.toString()}
                      onValueChange={(value) => updateSetting("refreshInterval", parseInt(value))}
                      disabled={!settings.autoRefresh}
                    >
                      <SelectTrigger id="refresh-interval"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3000">3 seconds</SelectItem>
                        <SelectItem value="5000">5 seconds</SelectItem>
                        <SelectItem value="10000">10 seconds</SelectItem>
                        <SelectItem value="30000">30 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Section>

                <Section title="🎮 Playground">
                  <div className="space-y-2">
                    <Label htmlFor="parking-idle-threshold" className="text-sm">Parking Idle Threshold</Label>
                    <Select
                      value={String(settings.parkingIdleThreshold ?? 120)}
                      onValueChange={(value) => updateSetting("parkingIdleThreshold", parseInt(value))}
                    >
                      <SelectTrigger id="parking-idle-threshold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="120">2 minutes</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                        <SelectItem value="600">10 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">How long before idle sessions move to parking</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-speed" className="text-sm">Movement Speed</Label>
                    <div className="flex items-center gap-4">
                      <input
                        id="playground-speed"
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.25"
                        value={settings.playgroundSpeed}
                        onChange={(e) => updateSetting("playgroundSpeed", parseFloat(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right font-mono">
                        {settings.playgroundSpeed}x
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>🐌 Slow</span>
                      <span>⚡ Fast</span>
                    </div>
                  </div>
                </Section>

                <CollapsibleSection
                  title="⏱️ Thresholds & Timing"
                  badge={overrideCount > 0 ? `${overrideCount} custom` : undefined}
                  defaultOpen={false}
                >
                  <ThresholdsTimingSection config={sessionConfig} />
                </CollapsibleSection>
              </div>
            )}

            {/* ═══ Tab: Data ═══ */}
            {selectedTab === "data" && (
              <div className="max-w-2xl space-y-6">
                <ProjectsBasePathSection />
                <BackupSection />
              </div>
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

      {/* ─── Create Room Dialog ─── */}
      <Dialog open={showCreateRoomDialog} onOpenChange={setShowCreateRoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
            <DialogDescription>
              Add a new workspace room for organizing your agents and sessions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g., Research Lab"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoom() }}
              />
              {newRoom.name && (
                <p className="text-xs text-muted-foreground">ID: {generateRoomId(newRoom.name)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ROOM_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setNewRoom({ ...newRoom, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                      newRoom.icon === icon
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {ROOM_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewRoom({ ...newRoom, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      newRoom.color === color
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${newRoom.color}20`, border: `2px solid ${newRoom.color}` }}
                >
                  {newRoom.icon}
                </div>
                <div>
                  <div className="font-semibold">{newRoom.name || "Room Name"}</div>
                  <div className="text-xs text-muted-foreground">
                    {newRoom.name ? generateRoomId(newRoom.name) : "room-id"}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoomDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRoom}>Create Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Room Dialog ─── */}
      <Dialog open={!!deleteRoomConfirm} onOpenChange={() => setDeleteRoomConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room?</DialogTitle>
            <DialogDescription>
              This will remove the room and unassign any sessions from it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRoomConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteRoomConfirm && handleDeleteRoom(deleteRoomConfirm)}>
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Rule Dialog ─── */}
      <Dialog open={showCreateRuleDialog} onOpenChange={setShowCreateRuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Routing Rule</DialogTitle>
            <DialogDescription>
              Define a condition to automatically route sessions to a room
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select
                value={newRule.rule_type}
                onValueChange={(value) =>
                  setNewRule({
                    ...newRule,
                    rule_type: value as RoomAssignmentRule["rule_type"],
                    rule_value: value === "session_type" ? SESSION_TYPES[0].value : "",
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{newRule.rule_type === "session_type" ? "Session Type" : "Match Value"}</Label>
              {newRule.rule_type === "session_type" ? (
                <Select
                  value={newRule.rule_value}
                  onValueChange={(value) => setNewRule({ ...newRule, rule_value: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Select session type" /></SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={newRule.rule_value}
                  onChange={(e) => setNewRule({ ...newRule, rule_value: e.target.value })}
                  placeholder={
                    newRule.rule_type === "session_key_contains" ? "e.g., :cron:" :
                    newRule.rule_type === "keyword" ? "e.g., implement" :
                    newRule.rule_type === "model" ? "e.g., opus" :
                    "Enter pattern..."
                  }
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Target Room</Label>
              <Select
                value={newRule.room_id}
                onValueChange={(value) => setNewRule({ ...newRule, room_id: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      <div className="flex items-center gap-2">
                        <span>{room.icon}</span>
                        <span>{room.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority ({newRule.priority})</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm text-muted-foreground w-12 text-right font-mono">{newRule.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher priority rules are evaluated first (100 = highest, 0 = lowest)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRuleDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRule}>Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Rule Dialog ─── */}
      <Dialog open={!!deleteRuleConfirm} onOpenChange={() => setDeleteRuleConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule?</DialogTitle>
            <DialogDescription>
              This rule will be permanently removed. Sessions may be routed differently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRuleConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteRuleConfirm && handleDeleteRule(deleteRuleConfirm)}>
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Projects Settings Section ───────────────────────────────────────────────

function ProjectsSettingsSection({
  projects,
  rooms,
  isLoading,
  onArchive,
  onUnarchive,
  onDelete,
  onUpdate,
}: {
  projects: Project[]
  rooms: Room[]
  isLoading: boolean
  onArchive: (id: string) => Promise<{ success: boolean; error?: string }>
  onUnarchive: (id: string) => Promise<{ success: boolean; error?: string }>
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  onUpdate: (id: string, updates: { name?: string; description?: string; icon?: string; color?: string; status?: string; folder_path?: string }) => Promise<{ success: boolean; error?: string }>
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [archiveError, setArchiveError] = useState<string | null>(null)

  // Sort: active first, then archived
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.status === "archived" && b.status !== "archived") return 1
    if (a.status !== "archived" && b.status === "archived") return -1
    return b.created_at - a.created_at
  })

  const getAssignedRoomCount = (projectId: string) =>
    rooms.filter(r => r.project_id === projectId).length

  const getAssignedRoomNames = (projectId: string) =>
    rooms.filter(r => r.project_id === projectId).map(r => `${r.icon || "🏠"} ${r.name}`)

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
      return "—"
    }
  }

  const projectToDelete = deleteConfirm ? projects.find(p => p.id === deleteConfirm) : null

  return (
    <>
      <CollapsibleSection
        title="📋 All Projects"
        badge={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
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
            {sortedProjects.map(project => {
              const isArchived = project.status === "archived"
              const roomCount = getAssignedRoomCount(project.id)
              const assignedRoomNames = getAssignedRoomNames(project.id)
              const isEditing = editingId === project.id

              return (
                <div
                  key={project.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isArchived
                      ? "bg-muted/30 opacity-60 border-border/50"
                      : "bg-background hover:bg-accent/20 border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Color dot + icon */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color || "#6b7280" }}
                      />
                      <span className="text-lg">{project.icon || "📋"}</span>
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
                              if (e.key === "Enter") handleSaveEdit(project.id)
                              if (e.key === "Escape") setEditingId(null)
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
                            <span>{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
                            {project.folder_path && (
                              <span className="truncate font-mono max-w-[200px]">{project.folder_path}</span>
                            )}
                            <span>Created {formatDate(project.created_at)}</span>
                          </div>
                          {/* Show assigned rooms if any */}
                          {roomCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {assignedRoomNames.map((name, i) => (
                                <span
                                  key={i}
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
                        {/* Edit */}
                        <button
                          onClick={() => handleStartEdit(project)}
                          className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Edit name"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Archive / Unarchive */}
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
                            title={roomCount > 0 ? "Remove from all rooms first" : "Archive project"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete — only archived */}
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
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              Delete project <strong>"{projectToDelete?.name}"</strong>? This action cannot be undone.
              <br /><br />
              <span className="text-muted-foreground">This will NOT delete any files on disk.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Projects Base Path Section ──────────────────────────────────────────────

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
    // Basic path validation
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

// ─── Backup Section ──────────────────────────────────────────────────────────

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

  const loadBackups = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listBackups()
      setBackups(list)
    } catch {
      // API not available yet
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
    // Reset file input so same file can be selected again
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
      const d = new Date(dateStr)
      return d.toLocaleString()
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
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5 h-10"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">Import</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="gap-1.5 h-10"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5" />
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
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
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
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {loading && backups.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading…
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No backups yet
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {backups.map((backup, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm"
                  >
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-xs font-medium">
                        {backup.filename}
                      </div>
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
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Backup?</DialogTitle>
            <DialogDescription>
              <span className="flex items-start gap-2 mt-2">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Warning:</strong> This will replace all current data
                  including connections, rooms, routing rules, and settings.
                  This action cannot be undone.
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          {pendingFileRef.current && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              File: <span className="font-mono">{pendingFileRef.current.name}</span>
              <span className="text-muted-foreground ml-2">
                ({formatSize(pendingFileRef.current.size)})
              </span>
            </div>
          )}
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Thresholds & Timing Section ─────────────────────────────────────────────

interface ConfigFieldProps {
  label: string
  description?: string
  configKey: SessionConfigKey
  value: number
  /** Display unit for the UI. We store ms internally. */
  unit: "seconds" | "minutes" | "count" | "speed" | "ms"
  min?: number
  max?: number
  step?: number
}

function ConfigField({ label, description, configKey, value, unit, min = 0, max, step }: ConfigFieldProps) {
  const overridden = isOverridden(configKey)
  const defaultVal = SESSION_CONFIG_DEFAULTS[configKey]

  // Convert stored ms to display unit
  const toDisplay = (v: number) => {
    if (unit === "seconds") return v / 1000
    if (unit === "minutes") return v / 60_000
    return v
  }
  // Convert display unit back to stored ms
  const fromDisplay = (v: number) => {
    if (unit === "seconds") return v * 1000
    if (unit === "minutes") return v * 60_000
    return v
  }

  const displayValue = toDisplay(value)
  const displayDefault = toDisplay(defaultVal)
  const displayStep = step ?? (unit === "minutes" ? 0.5 : unit === "seconds" ? 5 : unit === "speed" ? 0.1 : 1)
  const displayMax = max ? toDisplay(max) : undefined

  const unitLabel = unit === "seconds" ? "s" : unit === "minutes" ? "min" : unit === "ms" ? "ms" : unit === "speed" ? "×" : ""

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {overridden && (
            <button
              onClick={() => updateConfig(configKey, defaultVal)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              title={`Reset to default (${displayDefault}${unitLabel})`}
            >
              ↻
            </button>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={displayValue}
          onChange={(e) => {
            const num = parseFloat(e.target.value)
            if (!isNaN(num) && num >= min) {
              updateConfig(configKey, fromDisplay(num))
            }
          }}
          className="w-20 h-8 text-sm text-right font-mono"
          min={min}
          max={displayMax}
          step={displayStep}
        />
        <span className="text-xs text-muted-foreground w-6">{unitLabel}</span>
      </div>
    </div>
  )
}

function ThresholdsTimingSection({ config }: { config: Record<string, number> }) {
  return (
    <div className="space-y-5">
      {/* Status Thresholds */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session Status</h3>
        <ConfigField
          label="Active → Idle"
          description="Time before a session is considered idle"
          configKey="statusActiveThresholdMs"
          value={config.statusActiveThresholdMs}
          unit="minutes"
          min={0}
        />
        <ConfigField
          label="Idle → Sleeping"
          description="Time before a session is considered sleeping"
          configKey="statusSleepingThresholdMs"
          value={config.statusSleepingThresholdMs}
          unit="minutes"
          min={0}
        />
      </div>

      {/* 3D Bot Status */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">3D Bot Status</h3>
        <ConfigField
          label="Bot Idle Threshold"
          description="Time before a bot appears idle in the 3D world"
          configKey="botIdleThresholdMs"
          value={config.botIdleThresholdMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Bot Offline Threshold"
          description="Time before a bot goes offline in the 3D world"
          configKey="botSleepingThresholdMs"
          value={config.botSleepingThresholdMs}
          unit="minutes"
          min={0}
        />
      </div>

      {/* Activity Detection */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity Detection</h3>
        <ConfigField
          label="Token Change Window"
          description="Recent token changes within this window = actively running"
          configKey="tokenChangeThresholdMs"
          value={config.tokenChangeThresholdMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Updated-At Active"
          description="updatedAt within this window = actively running"
          configKey="updatedAtActiveMs"
          value={config.updatedAtActiveMs}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Parking */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parking / Break Area</h3>
        <ConfigField
          label="Parking Expiry"
          description="Hide parked sessions after this time"
          configKey="parkingExpiryMs"
          value={config.parkingExpiryMs}
          unit="minutes"
          min={0}
        />
        <ConfigField
          label="Max Visible Sessions"
          description="Sessions beyond this are overflow to parking"
          configKey="parkingMaxVisible"
          value={config.parkingMaxVisible}
          unit="count"
          min={1}
          step={1}
        />
        <ConfigField
          label="Max Bots Per Room"
          description="Limit rendered bots per room in 3D view"
          configKey="maxVisibleBotsPerRoom"
          value={config.maxVisibleBotsPerRoom}
          unit="count"
          min={1}
          step={1}
        />
      </div>

      {/* Bot Movement */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">3D Bot Movement</h3>
        <ConfigField
          label="Active Walk Speed"
          configKey="botWalkSpeedActive"
          value={config.botWalkSpeedActive}
          unit="speed"
          min={0.1}
          step={0.1}
        />
        <ConfigField
          label="Idle Wander Speed"
          configKey="botWalkSpeedIdle"
          value={config.botWalkSpeedIdle}
          unit="speed"
          min={0.1}
          step={0.1}
        />
        <ConfigField
          label="Wander Min Wait"
          description="Min seconds between random wander moves"
          configKey="wanderMinWaitS"
          value={config.wanderMinWaitS}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Wander Max Wait"
          description="Max seconds between random wander moves"
          configKey="wanderMaxWaitS"
          value={config.wanderMaxWaitS}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Polling */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Polling Intervals</h3>
        <ConfigField
          label="Log Viewer Refresh"
          configKey="logViewerPollMs"
          value={config.logViewerPollMs}
          unit="seconds"
          min={0}
        />
        <ConfigField
          label="Cron View Refresh"
          configKey="cronViewPollMs"
          value={config.cronViewPollMs}
          unit="seconds"
          min={0}
        />
      </div>

      {/* Reset All */}
      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => {
            resetConfig()
          }}
          disabled={getOverrideCount() === 0}
        >
          ↻ Reset All to Defaults
          {getOverrideCount() > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {getOverrideCount()} custom
            </Badge>
          )}
        </Button>
      </div>
    </div>
  )
}

export { DEFAULT_SETTINGS }
