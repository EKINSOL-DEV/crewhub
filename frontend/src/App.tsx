import { useState, useCallback, useEffect, useRef } from 'react'
import { World3DView } from './components/world3d/World3DView'
import { AllSessionsView } from './components/sessions/AllSessionsView'
import { CardsView } from './components/sessions/CardsView'
import { CronView } from './components/sessions/CronView'
import { HistoryView } from './components/sessions/HistoryView'
import { ConnectionsView } from './components/sessions/ConnectionsView'
import { StatsHeader } from './components/sessions/StatsHeader'
import { SettingsPanel, DEFAULT_SETTINGS, type SessionsSettings } from './components/sessions/SettingsPanel'
import { useSessionsStream } from './hooks/useSessionsStream'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { ChatProvider } from './contexts/ChatContext'
import { RoomsProvider } from './contexts/RoomsContext'
import { ChatWindowManager } from './components/chat/ChatWindowManager'
import { DevDesigns } from './components/dev/DevDesigns'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
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

type TabId = 'active' | 'cards' | 'all' | 'cron' | 'history' | 'connections'

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
  { id: 'connections', label: 'Connections', icon: <Cable className="h-4 w-4" /> },
]

function AppContent() {
  const { sessions, loading, error, connected, connectionMethod, refresh } = useSessionsStream(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
            if (data.connections && data.connections.length > 0) {
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CrewHub" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold">CrewHub <span className="text-xs font-normal text-muted-foreground ml-1">v0.7.0</span></h1>
              <p className="text-xs text-muted-foreground">Multi-agent orchestration</p>
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
        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-xl font-semibold mb-2">Connection Error</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refresh}>Retry</Button>
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'active' && (
                <World3DView
                  sessions={sessions}
                  settings={settings}
                  onAliasChanged={handleAliasChanged}
                />
              )}
              {activeTab === 'cards' && (
                <CardsView sessions={sessions} />
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
              {activeTab === 'connections' && (
                <ConnectionsView />
              )}
            </div>
          </ErrorBoundary>
        )}
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
      <RoomsProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </RoomsProvider>
    </ThemeProvider>
  )
}

export default App
