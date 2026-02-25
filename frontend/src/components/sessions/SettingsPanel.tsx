import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Palette,
  LayoutGrid,
  SlidersHorizontal,
  Wrench,
  FolderKanban,
  Cable,
  Bot,
  Shield,
  Database,
  Key,
} from 'lucide-react'
import { ConnectionsView } from './ConnectionsView'
import { AgentsSettingsTab } from './AgentsSettingsTab'
import { PersonasTab } from '@/components/persona/PersonasTab'
import { IdentityTab } from '@/components/persona/IdentityTab'

// ─── Extracted tab components ─────────────────────────────────────────────────
import { LookAndFeelTab } from '@/components/settings/LookAndFeelTab'
import { RoomsTab } from '@/components/settings/RoomsTab'
import { ProjectsTab } from '@/components/settings/ProjectsTab'
import { BehaviorTab } from '@/components/settings/BehaviorTab'
import { DataTab } from '@/components/settings/DataTab'
import { AdvancedTab } from '@/components/settings/AdvancedTab'
import { ApiKeysTab } from '@/components/settings/ApiKeysTab'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionsSettings {
  refreshInterval: number
  autoRefresh: boolean
  showAnimations: boolean
  playSound: boolean
  displayDensity: 'compact' | 'comfortable'
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
  displayDensity: 'comfortable',
  showBadges: true,
  easterEggsEnabled: true,
  playgroundSpeed: 1.0,
  parkingIdleThreshold: 120,
}

interface SettingsPanelProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly settings: SessionsSettings
  readonly onSettingsChange: (settings: SessionsSettings) => void
  /** Active sessions for testing routing rules */
  readonly sessions?: import('@/lib/api').CrewSession[]
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type SettingsTab =
  | 'look'
  | 'rooms'
  | 'projects'
  | 'agents'
  | 'personas'
  | 'identity'
  | 'behavior'
  | 'data'
  | 'connections'
  | 'apikeys'
  | 'advanced'

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'look', label: 'Look & Feel', icon: <Palette className="h-4 w-4" /> },
  { id: 'rooms', label: 'Rooms', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
  { id: 'agents', label: 'Agents', icon: <Bot className="h-4 w-4" /> },
  { id: 'personas', label: 'Personas', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: 'identity', label: 'Identity', icon: <Shield className="h-4 w-4" /> },
  { id: 'behavior', label: 'Behavior', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { id: 'data', label: 'Data', icon: <Database className="h-4 w-4" /> },
  { id: 'connections', label: 'Connections', icon: <Cable className="h-4 w-4" /> },
  { id: 'apikeys', label: 'API Keys', icon: <Key className="h-4 w-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <Wrench className="h-4 w-4" /> },
]

const SETTINGS_TAB_STORAGE_KEY = 'crewhub-settings-tab'

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPanel({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  sessions: activeSessions,
}: SettingsPanelProps) {
  // ─── Tab state (persisted in localStorage) ───
  const [selectedTab, setSelectedTab] = useState<SettingsTab>(() => {
    const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
    if (stored && SETTINGS_TABS.some((t) => t.id === stored)) return stored as SettingsTab
    return 'look'
  })

  // Re-read tab from localStorage when panel opens (e.g. from "Open Connections" button)
  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY)
      if (stored && SETTINGS_TABS.some((t) => t.id === stored)) {
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
      if (e.key === 'Escape' && !roomsHasModal) {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
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
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors -mb-px
                    ${
                      selectedTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
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
              {selectedTab === 'look' && (
                <LookAndFeelTab settings={settings} onSettingsChange={onSettingsChange} />
              )}
              {selectedTab === 'rooms' && (
                <RoomsTab sessions={activeSessions} onModalStateChange={setRoomsHasModal} />
              )}
              {selectedTab === 'projects' && <ProjectsTab />}
              {selectedTab === 'agents' && <AgentsSettingsTab />}
              {selectedTab === 'personas' && <PersonasTab />}
              {selectedTab === 'identity' && <IdentityTab />}
              {selectedTab === 'behavior' && (
                <BehaviorTab settings={settings} onSettingsChange={onSettingsChange} />
              )}
              {selectedTab === 'data' && <DataTab />}
              {selectedTab === 'connections' && <ConnectionsView embedded />}
              {selectedTab === 'apikeys' && <ApiKeysTab />}
              {selectedTab === 'advanced' && <AdvancedTab />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { DEFAULT_SETTINGS }
