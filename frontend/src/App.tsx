import { useState, useCallback } from 'react'
import { PlaygroundView } from './components/minions/PlaygroundView'
import { StatsHeader } from './components/minions/StatsHeader'
import { SettingsPanel, DEFAULT_SETTINGS, type MinionsSettings } from './components/minions/SettingsPanel'
import { useMinionsStream } from './hooks/useMinionsStream'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Settings, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from './components/ui/button'

function App() {
  const { sessions, loading, error, connected, connectionMethod, refresh } = useMinionsStream(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<MinionsSettings>(() => {
    const stored = localStorage.getItem('clawcrew-settings')
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      } catch {
        return DEFAULT_SETTINGS
      }
    }
    return DEFAULT_SETTINGS
  })

  const handleSettingsChange = useCallback((newSettings: MinionsSettings) => {
    setSettings(newSettings)
    localStorage.setItem('clawcrew-settings', JSON.stringify(newSettings))
  }, [])

  const handleAliasChanged = useCallback(() => {
    refresh()
  }, [refresh])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦀</span>
            <div>
              <h1 className="text-xl font-bold">ClawCrew</h1>
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
              <PlaygroundView
                sessions={sessions}
                settings={settings}
                onAliasChanged={handleAliasChanged}
              />
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

export default App
