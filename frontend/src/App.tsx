import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ZoneRenderer } from './components/world3d/ZoneRenderer'
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
import { ChatWindowManager } from './components/chat/ChatWindowManager'
import { DevDesigns } from './components/dev/DevDesigns'
import { BackendStatus } from './components/dev/BackendStatus'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { ZenMode, ZenModeButton, useZenMode, ZenModeProvider } from './components/zen'
import { getOnboardingStatus } from './lib/api'
import { Settings, RefreshCw, Wifi, WifiOff, LayoutGrid, Grid3X3, List, Clock, History, Cable } from 'lucide-react'
import { Button } from './components/ui/button'

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
              <h1 className="text-xl font-bold">CrewHub <span className="text-xs font-normal text-muted-foreground ml-1">v0.13.0</span></h1>
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
                : <ZoneRenderer
                    sessions={sessions}
                    settings={settings}
                    onAliasChanged={handleAliasChanged}
                  />
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

      <DemoModeIndicator />
      <MobileWarning />
      
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

function App() {
  const route = useRoute()
  
  if (route === '/dev/designs') {
    return <DevDesigns />
  }
  
  return (
    <ThemeProvider>
      <DemoProvider>
        <ZoneProvider>
          <RoomsProvider>
            <ZenModeProvider>
              <ChatProvider>
                <AppContent />
              </ChatProvider>
            </ZenModeProvider>
          </RoomsProvider>
        </ZoneProvider>
      </DemoProvider>
    </ThemeProvider>
  )
}

export default App
