import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { version } from '../package.json'
import { notificationManager } from './lib/notificationManager'
const ZoneRenderer = lazy(() => import('./components/world3d/ZoneRenderer').then(m => ({ default: m.ZoneRenderer })))
import { AllSessionsView } from './components/sessions/AllSessionsView'
import { CardsView } from './components/sessions/CardsView'
import { CronView } from './components/sessions/CronView'
import { HistoryView } from './components/sessions/HistoryView'
// ConnectionsView is now inside Settings > Connections tab
import { StatsHeader } from './components/sessions/StatsHeader'
import { SettingsPanel, DEFAULT_SETTINGS, type SessionsSettings } from './components/sessions/SettingsPanel'
import { useSessionsStream } from './hooks/useSessionsStream'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { ChatProvider, useChatContext } from './contexts/ChatContext'
import { RoomsProvider, useRoomsContext } from './contexts/RoomsContext'
import { DemoProvider, DemoModeIndicator, useDemoMode } from './contexts/DemoContext'
import { ZoneProvider } from './contexts/ZoneContext'
// ZoneSwitcher moved to RoomTabsBar
import { MobileWarning } from './components/MobileWarning'
import { MobileLayout } from './components/mobile/MobileLayout'
import { SettingsView } from './components/SettingsView'
import { AppHealthGate } from './components/AppHealthGate'
import { useMobile } from './hooks/useMobile'
import { ChatWindowManager } from './components/chat/ChatWindowManager'
import { DevDesigns } from './components/dev/DevDesigns'
import { BackendStatus } from './components/dev/BackendStatus'
import { DevToolbar } from './components/dev/DevErrorViewer'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { ZenMode, ZenModeButton, useZenMode, ZenModeProvider } from './components/zen'
import type { ZenProjectFilter } from './components/zen/hooks/useZenMode'
import { ProjectManagerModal } from './components/zen/ProjectManagerModal'
import { getOnboardingStatus, API_BASE } from './lib/api'
import { Settings, RefreshCw, Wifi, WifiOff, LayoutGrid, Grid3X3, List, Clock, History, Cable } from 'lucide-react'
import { Button } from './components/ui/button'
import { DesktopActivityFeed, DesktopActivityFeedButton, useDesktopActivityFeed } from './components/desktop/DesktopActivityFeed'
import { CreatorModeProvider } from './contexts/CreatorModeContext'

/** Open the standalone Zen Mode Tauri window (or focus it if already open). */
async function openZenWindow() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_zen_window')
  } catch (err) {
    console.warn('[CrewHub] openZenWindow failed:', err)
  }
}

// ── URL Parameter Detection ────────────────────────────────────
function isZenModeUrl(): boolean {
  return new URLSearchParams(window.location.search).get('mode') === 'zen'
}

/**
 * Detect whether we're in the Tauri compact chat window.
 *
 * Uses window.__TAURI_VIEW__ injected by initializationScript in lib.rs —
 * more reliable than query params: survives navigation, works in dev and
 * production, no React Router side effects.
 *
 * Falls back to query param (?view=mobile) for dev convenience when testing
 * outside Tauri (e.g. directly in the browser during development).
 */
function isTauriMobileView(): boolean {
  if (window.__TAURI_VIEW__ === 'mobile') return true
  // Dev fallback: allow ?view=mobile in browser for UI testing
  return new URLSearchParams(window.location.search).get('view') === 'mobile'
}

/**
 * Detect whether we're in the Tauri settings window.
 * Uses window.__TAURI_VIEW__ injected by initializationScript in lib.rs.
 * Falls back to query param ?view=settings for dev convenience.
 */
function isTauriSettingsView(): boolean {
  // Cast to string to handle the injected value (bypasses strict union comparison)
  if ((window.__TAURI_VIEW__ as string | undefined) === 'settings') return true
  return new URLSearchParams(window.location.search).get('view') === 'settings'
}

// Simple path-based routing for dev pages
function useRoute() {
  const [path, setPath] = useState(window.location.pathname)
  
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])
  
  return path
}

type TabId = 'active' | 'cards' | 'all' | 'cron' | 'history'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'active', label: 'Active', icon: <LayoutGrid className="h-4 w-4" /> },
  { id: 'cards', label: 'Cards', icon: <Grid3X3 className="h-4 w-4" /> },
  { id: 'all', label: 'All', icon: <List className="h-4 w-4" /> },
  { id: 'cron', label: 'Cron', icon: <Clock className="h-4 w-4" /> },
  { id: 'history', label: 'History', icon: <History className="h-4 w-4" /> },
]

/**
 * Lightweight placeholder shown instead of GPU-heavy 3D world or data-dependent
 * Cards view when there are no sessions to display (backend unreachable or no
 * gateway connection configured).
 */
function NoConnectionView({
  connected,
  loading,
  error,
  onRetry,
  onOpenConnections,
}: {
  connected: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpenConnections: () => void
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-4">Connecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <WifiOff className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
          </>
        ) : connected ? (
          <>
            <div className="text-5xl mb-4">📡</div>
            <h2 className="text-xl font-semibold mb-2">No Active Sessions</h2>
            <p className="text-muted-foreground mb-6">
              CrewHub is connected but no agent sessions are running.
              Configure a gateway connection or start an agent to see the 3D world.
            </p>
          </>
        ) : (
          <>
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Connection</h2>
            <p className="text-muted-foreground mb-6">
              Unable to reach the CrewHub backend.
              Make sure the server is running and try again.
            </p>
          </>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button onClick={onOpenConnections}>
            <Cable className="h-4 w-4 mr-2" />
            Connections
          </Button>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { sessions: realSessions, loading, error, connected, connectionMethod, refresh } = useSessionsStream(true)
  const { isDemoMode, demoSessions } = useDemoMode()
  const { windows } = useChatContext()
  const { rooms, getRoomForSession } = useRoomsContext()
  
  // Desktop Activity Feed state
  const activityFeed = useDesktopActivityFeed()

  // Zen Mode state
  const zenMode = useZenMode()
  
  // Get the last active chat window for Zen Mode context
  const lastActiveWindow = windows.length > 0 ? windows[windows.length - 1] : null
  
  // Get room name for the selected agent
  const zenRoomName = useMemo(() => {
    if (!zenMode.selectedAgentId) return undefined
    const roomId = getRoomForSession(zenMode.selectedAgentId)
    if (!roomId) return undefined
    const room = rooms.find(r => r.id === roomId)
    return room?.name
  }, [zenMode.selectedAgentId, getRoomForSession, rooms])
  
  // Global keyboard listener for Zen Mode toggle (Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Z to toggle Zen Mode
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.stopPropagation()
        
        if (zenMode.isActive) {
          zenMode.exit()
        } else {
          // If there's an active chat window, use its agent
          if (lastActiveWindow) {
            zenMode.enter(
              lastActiveWindow.sessionKey,
              lastActiveWindow.agentName,
              lastActiveWindow.agentIcon ?? undefined,
              lastActiveWindow.agentColor ?? undefined
            )
          } else {
            // Enter without a selected agent
            zenMode.enter()
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zenMode, lastActiveWindow])

  // Auto-launch Zen Mode if setting is enabled (once on mount)
  const zenAutoLaunchRef = useRef(false)
  useEffect(() => {
    if (zenAutoLaunchRef.current) return
    if (localStorage.getItem('crewhub-zen-auto-launch') === 'true' && !zenMode.isActive) {
      zenAutoLaunchRef.current = true
      zenMode.enter()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Handle entering Zen Mode via button
  const handleEnterZenMode = useCallback(() => {
    if (lastActiveWindow) {
      zenMode.enter(
        lastActiveWindow.sessionKey,
        lastActiveWindow.agentName,
        lastActiveWindow.agentIcon ?? undefined,
        lastActiveWindow.agentColor ?? undefined
      )
    } else {
      zenMode.enter()
    }
  }, [zenMode, lastActiveWindow])

  // When demo mode is active, replace real sessions with demo data.
  // Demo sessions completely replace real ones so the 3D world looks
  // consistently populated regardless of actual backend state.
  const sessions = useMemo(() => {
    if (!isDemoMode || demoSessions.length === 0) return realSessions
    // Build a set of demo keys to replace any matching real sessions
    const demoKeys = new Set(demoSessions.map(s => s.key))
    const nonOverlapping = realSessions.filter(s => !demoKeys.has(s.key))
    return [...demoSessions, ...nonOverlapping]
  }, [isDemoMode, demoSessions, realSessions])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const openConnectionsSettings = useCallback(() => {
    localStorage.setItem('crewhub-settings-tab', 'connections')
    setSettingsOpen(true)
  }, [])
  const [activeTab, setActiveTab] = useState<TabId>('active')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const onboardingCheckRef = useRef(false)
  const [settings, setSettings] = useState<SessionsSettings>(() => {
    const stored = localStorage.getItem('crewhub-settings')
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      } catch {
        return DEFAULT_SETTINGS
      }
    }
    return DEFAULT_SETTINGS
  })

  // Check onboarding status on mount
  useEffect(() => {
    if (onboardingCheckRef.current) return
    onboardingCheckRef.current = true

    const checkOnboarding = async () => {
      // Force onboarding via URL param: ?onboarding=true
      if (new URLSearchParams(window.location.search).get('onboarding') === 'true') {
        setShowOnboarding(true)
        setOnboardingChecked(true)
        return
      }

      // Quick localStorage check first
      if (localStorage.getItem('crewhub-onboarded') === 'true') {
        setOnboardingChecked(true)
        return
      }

      // Try API check
      try {
        const status = await getOnboardingStatus()
        if (status.completed || status.connections_count > 0) {
          // Already set up
          localStorage.setItem('crewhub-onboarded', 'true')
          setOnboardingChecked(true)
        } else {
          setShowOnboarding(true)
          setOnboardingChecked(true)
        }
      } catch {
        // API unavailable — check if connections exist via connections endpoint
        try {
          const resp = await fetch('/api/connections')
          if (resp.ok) {
            const data = await resp.json()
            const connCount = data.connections?.length ?? 0
            if (connCount > 0) {
              localStorage.setItem('crewhub-onboarded', 'true')
              setOnboardingChecked(true)
              return
            }
          }
        } catch {
          // Ignore
        }
        // No API, no localStorage flag → show onboarding
        setShowOnboarding(true)
        setOnboardingChecked(true)
      }
    }
    checkOnboarding()
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    refresh()
  }, [refresh])

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false)
  }, [])

  const handleSettingsChange = useCallback((newSettings: SessionsSettings) => {
    setSettings(newSettings)
    localStorage.setItem('crewhub-settings', JSON.stringify(newSettings))
  }, [])

  const handleAliasChanged = useCallback(() => {
    refresh()
  }, [refresh])

  const refreshClass = loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
  const tabClass = (isActive: boolean) => 
    `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
      isActive 
        ? 'bg-background text-foreground shadow-sm' 
        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
    }`

  return (
    <div 
      className="h-dvh bg-background flex flex-col overflow-hidden"
      
      
    >
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CrewHub" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold">CrewHub <span className="text-xs font-normal text-muted-foreground ml-1">v{version}</span></h1>
              <p className="text-xs text-muted-foreground">Multi-agent orchestration<BackendStatus /></p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {connected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span>{connectionMethod === 'sse' ? 'Live' : 'Polling'}</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
            
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={refreshClass} />
            </Button>

            {/* Zen Window button — only in Tauri desktop */}
            {!!window.__TAURI_INTERNALS__ && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openZenWindow}
                title="Open Zen Mode in separate window"
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>🧘</span>
              </Button>
            )}
            
            <DesktopActivityFeedButton
              isOpen={activityFeed.isOpen}
              onClick={activityFeed.toggle}
            />

            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="px-4 pb-3">
          <StatsHeader sessions={sessions} />
        </div>
        
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={tabClass(activeTab === tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'active' && (
              sessions.length === 0
                ? <NoConnectionView connected={connected} loading={loading} error={error} onRetry={refresh} onOpenConnections={openConnectionsSettings} />
                : <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground">Loading 3D view…</div>}>
                    <ZoneRenderer
                      sessions={sessions}
                      settings={settings}
                      onAliasChanged={handleAliasChanged}
                    />
                  </Suspense>
            )}
            {activeTab === 'cards' && (
              sessions.length === 0
                ? <NoConnectionView connected={connected} loading={loading} error={error} onRetry={refresh} onOpenConnections={openConnectionsSettings} />
                : <CardsView sessions={sessions} />
            )}
            {activeTab === 'all' && (
              <AllSessionsView sessions={sessions} />
            )}
            {activeTab === 'cron' && (
              <CronView />
            )}
            {activeTab === 'history' && (
              <HistoryView />
            )}
          </div>
        </ErrorBoundary>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        sessions={sessions}
      />

      <ChatWindowManager />

      {showOnboarding && onboardingChecked && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Desktop Activity Feed — fixed right sidebar */}
      <DesktopActivityFeed
        isOpen={activityFeed.isOpen}
        onClose={activityFeed.close}
      />

      <DemoModeIndicator />
      <MobileWarning />
      <DevToolbar />
      
      {/* Zen Mode Entry Button - shown when not in Zen Mode */}
      {!zenMode.isActive && sessions.length > 0 && (
        <ZenModeButton onClick={handleEnterZenMode} />
      )}
      
      {/* Zen Mode Overlay - full-screen when active */}
      {zenMode.isActive && (
        <ZenMode
          sessionKey={zenMode.selectedAgentId}
          agentName={zenMode.selectedAgentName}
          agentIcon={zenMode.selectedAgentIcon}
          agentColor={zenMode.selectedAgentColor}
          roomName={zenRoomName}
          connected={connected}
          onExit={zenMode.exit}
          projectFilter={zenMode.projectFilter}
          onClearProjectFilter={zenMode.clearProjectFilter}
        />
      )}
    </div>
  )
}

// ── Zen Mode Workspace Selector (for ?mode=zen) ───────────────

interface ZenProject {
  id: string
  name: string
  color: string | null
  description: string | null
}

function ZenWorkspaceSelector({ onSelect, onEnterAll }: { 
  onSelect: (project: ZenProject) => void
  onEnterAll: () => void 
}) {
  const [projects, setProjects] = useState<ZenProject[]>([])
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
    <div style={{
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
          🚀 Enter Zen Mode
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

        {/* Link to full CrewHub */}
        <a
          href="/"
          style={{
            display: 'block',
            marginTop: '24px',
            fontSize: '0.8rem',
            color: '#565f89',
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#7aa2f7' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#565f89' }}
        >
          🌍 Exit to Full CrewHub
        </a>
      </div>

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

// ── Zen Mode App Content (for ?mode=zen) ───────────────────────

function ZenModeAppContent() {
  const zenMode = useZenMode()
  const { connected } = useSessionsStream()
  const { rooms, getRoomForSession } = useRoomsContext()

  const zenRoomName = useMemo(() => {
    if (!zenMode.selectedAgentId) return undefined
    const roomId = getRoomForSession(zenMode.selectedAgentId)
    if (!roomId) return undefined
    return rooms.find(r => r.id === roomId)?.name
  }, [zenMode.selectedAgentId, getRoomForSession, rooms])

  const handleSelectProject = useCallback((project: ZenProject) => {
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

  const handleExit = useCallback(() => {
    zenMode.exit()
  }, [zenMode])

  if (!zenMode.isActive) {
    return (
      <ZenWorkspaceSelector
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

function ZenModeApp() {
  return (
    <RoomsProvider>
      <ZenModeProvider>
        <ZenModeAppContent />
      </ZenModeProvider>
    </RoomsProvider>
  )
}

// ── Main App Router ────────────────────────────────────────────

function App() {
  const route = useRoute()
  const isMobile = useMobile()

  // Initialize system notifications + tray badge in Tauri desktop context.
  // Only runs once on mount; safe no-op in browser.
  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      notificationManager.init().catch(err =>
        console.warn('[App] NotificationManager init failed:', err)
      )
    }
    return () => {
      if (window.__TAURI_INTERNALS__) {
        notificationManager.destroy()
      }
    }
  }, [])
  
  if (route === '/dev/designs') {
    return <DevDesigns />
  }

  // Tauri desktop: settings window (window.__TAURI_VIEW__ === 'settings')
  if (isTauriSettingsView()) {
    return (
      <ThemeProvider>
        <SettingsView />
      </ThemeProvider>
    )
  }

  // Tauri desktop: compact chat window (window.__TAURI_VIEW__ === 'mobile')
  // Explicitly render MobileLayout regardless of screen size — wraps in
  // AppHealthGate so the user sees a friendly error if backend is down.
  if (isTauriMobileView()) {
    return (
      <ThemeProvider>
        <DemoProvider>
          <RoomsProvider>
            <ChatProvider>
              <AppHealthGate>
                <MobileLayout />
              </AppHealthGate>
            </ChatProvider>
          </RoomsProvider>
        </DemoProvider>
      </ThemeProvider>
    )
  }

  // URL parameter Zen Mode: ?mode=zen
  if (isZenModeUrl()) {
    return <ZenModeApp />
  }

  // Mobile: chat-first experience — wrap with providers so MobileLayout
  // can safely call useDemoMode(), useRoomsContext(), etc.
  if (isMobile) {
    return (
      <ThemeProvider>
        <DemoProvider>
          <RoomsProvider>
            <ChatProvider>
              <MobileLayout />
            </ChatProvider>
          </RoomsProvider>
        </DemoProvider>
      </ThemeProvider>
    )
  }
  
  return (
    <ThemeProvider>
      <DemoProvider>
        <ZoneProvider>
          <RoomsProvider>
            <ZenModeProvider>
              <ChatProvider>
                <CreatorModeProvider>
                  {/* AppHealthGate: in Tauri desktop, shows error screen if
                      backend on localhost:8091 is not running. In browser,
                      passes through directly (health check skipped). */}
                  <AppHealthGate>
                    <AppContent />
                  </AppHealthGate>
                </CreatorModeProvider>
              </ChatProvider>
            </ZenModeProvider>
          </RoomsProvider>
        </ZoneProvider>
      </DemoProvider>
    </ThemeProvider>
  )
}

export default App
