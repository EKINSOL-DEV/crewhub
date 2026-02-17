import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { RefreshCw, ServerCrash } from 'lucide-react'
import { Button } from './ui/button'

const BACKEND_URL = localStorage.getItem('crewhub_backend_url') || (window as any).__CREWHUB_BACKEND_URL__ || import.meta.env.VITE_API_URL || 'http://localhost:8091'
const HEALTH_ENDPOINT = `${BACKEND_URL}/api/health`
const RECHECK_INTERVAL_MS = 10_000

type HealthStatus = 'checking' | 'ok' | 'down'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when running inside the Tauri desktop app.
 * Outside Tauri (plain browser) we skip health checks — the backend
 * is assumed reachable (same origin or configured reverse proxy).
 */
function isInTauri(): boolean {
  return typeof window.__TAURI__ !== 'undefined'
}

async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const resp = await fetch(HEALTH_ENDPOINT, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
    return resp.ok
  } catch {
    return false
  }
}

// ── UI Components ─────────────────────────────────────────────────────────────

function CheckingScreen() {
  return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Connecting to CrewHub backend…</p>
      </div>
    </div>
  )
}

interface DownScreenProps {
  onRetry: () => void
  retrying: boolean
}

function BackendDownScreen({ onRetry, retrying }: DownScreenProps) {
  return (
    <div className="h-dvh bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <ServerCrash className="h-14 w-14 mx-auto text-red-400 mb-5" />
        <h1 className="text-xl font-bold mb-2">Backend not reachable</h1>
        <p className="text-sm text-muted-foreground mb-6">
          CrewHub can't connect to the backend at{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
            {BACKEND_URL.replace(/^https?:\/\//, '')}
          </code>
          . Make sure it's running.
        </p>

        {/* Start command */}
        <div className="bg-muted rounded-lg p-4 mb-6 text-left">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Start the backend:
          </p>
          <code className="text-xs font-mono text-foreground break-all">
            cd ~/ekinapps/crewhub/backend
            <br />
            python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8091
          </code>
        </div>

        <div className="flex gap-3 justify-center">
          <Button onClick={onRetry} disabled={retrying}>
            <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Checking…' : 'Retry'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-5">
          Auto-retrying every {RECHECK_INTERVAL_MS / 1000}s
        </p>
      </div>
    </div>
  )
}

// ── AppHealthGate ─────────────────────────────────────────────────────────────

interface AppHealthGateProps {
  children: ReactNode
}

/**
 * AppHealthGate — guards the app behind a backend health check.
 *
 * Behaviour:
 * - **In Tauri desktop:** performs a health check on `localhost:8091` before
 *   rendering children. Shows a friendly error screen if backend is down.
 *   Auto-rechecks every 10 seconds.
 * - **In browser (non-Tauri):** passes children through immediately — no
 *   health check needed (same-origin or proxy handles routing).
 *
 * Place this around the top-level app content (both chat and world windows).
 */
export function AppHealthGate({ children }: AppHealthGateProps) {
  const [status, setStatus] = useState<HealthStatus>(() =>
    // In browser: skip check, go straight to ok
    isInTauri() ? 'checking' : 'ok'
  )
  const [retrying, setRetrying] = useState(false)

  const runCheck = useCallback(async (isManual = false) => {
    if (isManual) setRetrying(true)
    const healthy = await checkBackendHealth()
    setStatus(healthy ? 'ok' : 'down')
    if (isManual) setRetrying(false)
  }, [])

  // Initial check + periodic recheck
  useEffect(() => {
    if (!isInTauri()) return // Browser mode — no checks needed

    runCheck()

    const interval = setInterval(() => runCheck(), RECHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [runCheck])

  if (status === 'checking') return <CheckingScreen />
  if (status === 'down') {
    return (
      <BackendDownScreen
        onRetry={() => runCheck(true)}
        retrying={retrying}
      />
    )
  }

  return <>{children}</>
}
