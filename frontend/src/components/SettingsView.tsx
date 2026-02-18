import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { showToast } from '@/lib/toast'
import { ToastContainer } from './ui/toast-container'

const STORAGE_KEY = 'crewhub_backend_url'
const DEFAULT_URL = 'http://localhost:8091'

function getEffectiveUrl(): string {
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (window as any).__CREWHUB_BACKEND_URL__ ||
    import.meta.env.VITE_API_URL ||
    DEFAULT_URL
  )
}

async function closeSettingsWindow() {
  try {
    // Use Tauri API to hide the settings window
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().hide()
  } catch {
    // Not in Tauri or API unavailable — just do nothing
  }
}

export function SettingsView() {
  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [effectiveUrl, setEffectiveUrl] = useState(getEffectiveUrl)

  useEffect(() => {
    setEffectiveUrl(getEffectiveUrl())
  }, [url])

  const handleSave = () => {
    const trimmed = url.trim()
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    showToast({ message: '✅ Backend URL saved. Restart the app to apply.', duration: 4000 })
    setTimeout(() => closeSettingsWindow(), 1200)
  }

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUrl('')
    setEffectiveUrl(getEffectiveUrl())
    showToast({ message: '🔄 Reset to default URL.', duration: 3000 })
  }

  return (
    <div className="h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="CrewHub" className="h-8 w-8" />
          <div>
            <h1 className="text-base font-bold leading-tight">CrewHub Settings</h1>
            <p className="text-xs text-muted-foreground">Configure your backend connection</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-5 py-5 flex flex-col gap-5 overflow-auto">
        {/* Backend URL field */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="backend-url" className="text-sm font-medium">
            Backend URL
          </Label>
          <Input
            id="backend-url"
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder={DEFAULT_URL}
            className="font-mono text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use the default URL.
          </p>
        </div>

        {/* Effective URL indicator */}
        <div className="rounded-md bg-muted/50 border px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">
            Currently active
          </p>
          <code className="text-xs font-mono text-foreground break-all">
            {effectiveUrl}
          </code>
          {!localStorage.getItem(STORAGE_KEY) && (
            <p className="text-xs text-muted-foreground mt-1">(default)</p>
          )}
        </div>
      </div>

      {/* Footer buttons */}
      <footer className="border-t bg-card px-5 py-4 flex items-center justify-between shrink-0">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset to default
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </footer>

      <ToastContainer />
    </div>
  )
}
