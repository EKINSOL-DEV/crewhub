import { useState, useCallback } from 'react'
import { PlaygroundView } from './components/sessions/PlaygroundView'
import { AllSessionsView } from './components/sessions/AllSessionsView'
import { CardsView } from './components/sessions/CardsView'
import { CronView } from './components/sessions/CronView'
import { HistoryView } from './components/sessions/HistoryView'
import { StatsHeader } from './components/sessions/StatsHeader'
import { SettingsPanel, DEFAULT_SETTINGS, type SessionsSettings } from './components/sessions/SettingsPanel'
import { useSessionsStream } from './hooks/useSessionsStream'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { Settings, RefreshCw, Wifi, WifiOff, LayoutGrid, Grid3X3, List, Clock, History } from 'lucide-react'
import { Button } from './components/ui/button'

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

function AppContent() {
  const { sessions, loading, error, connected, connectionMethod, refresh } = useSessionsStream(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('active')
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

  const handleSettingsChange = useCallback((newSettings: SessionsSettings) => {
    setSettings(newSettings)
    localStorage.setItem('crewhub-settings', JSON.stringify(newSettings))
  }, [])

  const handleAliasChanged = useCallback(() => {
    refresh()
  }, [refresh])

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="CrewHub" className="h-10 w-10" />
            <div>
              <h1 className="text-xl font-bold">CrewHub</h1>
              <p className="text-xs text-muted-foreground">Multi-agent orchestration</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection status */}
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
            
            {/* Refresh button */}
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* Settings button */}
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Stats Header */}
        <div className="px-4 pb-3">
          <StatsHeader sessions={sessions} />
        </div>
        
        {/* Tab Navigation */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${activeTab === tab.id 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
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
                <PlaygroundView
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
            </div>
          </ErrorBoundary>
        )}
      </main>

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
