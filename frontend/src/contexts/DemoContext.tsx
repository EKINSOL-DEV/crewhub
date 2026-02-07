// ─── Demo Mode Context ──────────────────────────────────────────
// Provides mock session data for screenshots and demos.
// Toggle with F5. Persists state in localStorage.
// Does NOT make any API calls — purely frontend overlay.

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { CrewSession } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────

interface DemoContextValue {
  isDemoMode: boolean
  toggleDemoMode: () => void
  demoSessions: CrewSession[]
  /** Room assignments for demo sessions: sessionKey → roomId */
  demoRoomAssignments: Map<string, string>
}

const DemoContext = createContext<DemoContextValue | null>(null)

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-demo-mode'
const EVENT_NAME = 'crewhub-demo-mode-changed'

// ─── Mock Data ──────────────────────────────────────────────────

function createDemoSessions(): CrewSession[] {
  const now = Date.now()
  // Stagger updatedAt slightly so sessions look naturally timed
  return [
    // Main agent sessions
    {
      key: 'agent:main:main',
      kind: 'agent',
      channel: 'whatsapp',
      displayName: 'Assistent',
      label: 'Reviewing pull request #127',
      updatedAt: now - 5_000,        // 5s ago — active
      sessionId: 'demo-main',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 48_200,
      contextTokens: 12_400,
    },
    {
      key: 'agent:dev:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Dev',
      label: 'Building REST API endpoints',
      updatedAt: now - 3_000,        // 3s ago — active
      sessionId: 'demo-dev',
      model: 'claude-opus-4-20250514',
      totalTokens: 127_500,
      contextTokens: 34_200,
    },
    {
      key: 'agent:gamedev:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Game Dev',
      label: 'Optimizing 3D render pipeline',
      updatedAt: now - 8_000,        // 8s ago — active
      sessionId: 'demo-gamedev',
      model: 'claude-opus-4-20250514',
      totalTokens: 89_300,
      contextTokens: 22_100,
    },
    {
      key: 'agent:flowy:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Flowy',
      label: 'Writing blog post draft',
      updatedAt: now - 12_000,       // 12s ago — active
      sessionId: 'demo-flowy',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 34_600,
      contextTokens: 8_900,
    },
    {
      key: 'agent:reviewer:main',
      kind: 'agent',
      channel: 'internal',
      displayName: 'Reviewer',
      label: 'Waiting for code review',
      updatedAt: now - 90_000,       // 90s ago — idle
      sessionId: 'demo-reviewer',
      model: 'gpt-5.2',
      totalTokens: 15_800,
      contextTokens: 4_200,
    },
    // Subagent sessions
    {
      key: 'agent:dev:subagent:fix-auth-middleware',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'fix-auth-middleware',
      updatedAt: now - 4_000,        // 4s ago — active
      sessionId: 'demo-sub-auth',
      model: 'claude-opus-4-20250514',
      totalTokens: 41_200,
      contextTokens: 11_300,
    },
    {
      key: 'agent:dev:subagent:design-landing-page',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'design-landing-page',
      updatedAt: now - 7_000,        // 7s ago — active
      sessionId: 'demo-sub-landing',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 28_400,
      contextTokens: 7_600,
    },
    {
      key: 'agent:dev:subagent:database-migration-v3',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'database-migration-v3',
      updatedAt: now - 120_000,      // 2 min ago — idle
      sessionId: 'demo-sub-migration',
      model: 'claude-opus-4-20250514',
      totalTokens: 19_800,
      contextTokens: 5_100,
    },
    {
      key: 'agent:dev:subagent:unit-test-coverage',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'unit-test-coverage',
      updatedAt: now - 2_000,        // 2s ago — active
      sessionId: 'demo-sub-tests',
      model: 'claude-opus-4-20250514',
      totalTokens: 55_700,
      contextTokens: 14_800,
    },
    {
      key: 'agent:flowy:subagent:social-media-campaign',
      kind: 'subagent',
      channel: 'internal',
      displayName: undefined,
      label: 'social-media-campaign',
      updatedAt: now - 6_000,        // 6s ago — active
      sessionId: 'demo-sub-social',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 22_100,
      contextTokens: 6_200,
    },
  ]
}

/** Map demo session keys to room IDs */
function createDemoRoomAssignments(): Map<string, string> {
  return new Map([
    ['agent:main:main', 'headquarters'],
    ['agent:dev:main', 'dev-room'],
    ['agent:gamedev:main', 'dev-room'],
    ['agent:flowy:main', 'marketing-room'],
    ['agent:reviewer:main', 'thinking-room'],
    ['agent:dev:subagent:fix-auth-middleware', 'dev-room'],
    ['agent:dev:subagent:design-landing-page', 'creative-room'],
    ['agent:dev:subagent:database-migration-v3', 'ops-room'],
    ['agent:dev:subagent:unit-test-coverage', 'dev-room'],
    ['agent:flowy:subagent:social-media-campaign', 'marketing-room'],
  ])
}

// ─── Toast (reusing debug toast pattern) ────────────────────────

let toastTimeout: ReturnType<typeof setTimeout> | null = null
let toastElement: HTMLDivElement | null = null

function showDemoToast(enabled: boolean) {
  if (toastElement) {
    toastElement.remove()
    toastElement = null
  }
  if (toastTimeout) {
    clearTimeout(toastTimeout)
    toastTimeout = null
  }

  const el = document.createElement('div')
  el.textContent = enabled ? '🎬 Demo Mode: ON' : '🎬 Demo Mode: OFF'
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 18px',
    borderRadius: '8px',
    background: enabled ? 'rgba(234, 88, 12, 0.9)' : 'rgba(0, 0, 0, 0.75)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
    zIndex: '99999',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
    transition: 'opacity 0.3s ease',
    opacity: '1',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  })

  document.body.appendChild(el)
  toastElement = el

  toastTimeout = setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => {
      el.remove()
      if (toastElement === el) toastElement = null
    }, 300)
  }, 1800)
}

// ─── Focus Guard ────────────────────────────────────────────────

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  if (el.closest('.monaco-editor, .cm-editor')) return true
  return false
}

// ─── Provider ───────────────────────────────────────────────────

const isPublicDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    // Always on for public demo builds
    if (isPublicDemo) return true
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Refresh demo sessions on each toggle (so updatedAt is always recent)
  const [demoSessions, setDemoSessions] = useState<CrewSession[]>(() =>
    isDemoMode ? createDemoSessions() : []
  )
  const [demoRoomAssignments] = useState<Map<string, string>>(() => createDemoRoomAssignments())

  const isDemoRef = useRef(isDemoMode)
  isDemoRef.current = isDemoMode

  const toggleDemoMode = useCallback(() => {
    const next = !isDemoRef.current
    setIsDemoMode(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    window.dispatchEvent(new Event(EVENT_NAME))
    showDemoToast(next)

    if (next) {
      // Generate fresh sessions with current timestamps
      setDemoSessions(createDemoSessions())
    } else {
      setDemoSessions([])
    }
  }, [])

  // Keep demo sessions fresh — update timestamps periodically while demo mode is on
  useEffect(() => {
    if (!isDemoMode) return

    const interval = setInterval(() => {
      setDemoSessions(createDemoSessions())
    }, 30_000) // Refresh every 30s to keep timestamps looking active

    return () => clearInterval(interval)
  }, [isDemoMode])

  // F5 keybinding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' && !isInputFocused()) {
        e.preventDefault()
        e.stopPropagation()
        toggleDemoMode()
      }
    }

    // Use capture phase to intercept before browser refresh
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [toggleDemoMode])

  // Listen for cross-tab / cross-component changes
  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem(STORAGE_KEY) === 'true'
      if (stored !== isDemoRef.current) {
        setIsDemoMode(stored)
        if (stored) {
          setDemoSessions(createDemoSessions())
        } else {
          setDemoSessions([])
        }
      }
    }
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handler()
    }
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  return (
    <DemoContext.Provider value={{ isDemoMode, toggleDemoMode, demoSessions, demoRoomAssignments }}>
      {children}
    </DemoContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────

export function useDemoMode() {
  const context = useContext(DemoContext)
  if (!context) {
    throw new Error('useDemoMode must be used within a DemoProvider')
  }
  return context
}

// ─── Demo Indicator Component ───────────────────────────────────

const DEMO_BANNER_DISMISSED_KEY = 'crewhub-demo-banner-dismissed'

export function DemoModeIndicator() {
  const { isDemoMode } = useDemoMode()
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(DEMO_BANNER_DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true)
    try {
      localStorage.setItem(DEMO_BANNER_DISMISSED_KEY, 'true')
    } catch {
      // Ignore storage errors
    }
  }, [])

  if (!isDemoMode && !isPublicDemo) return null

  // Public demo: show a banner with GitHub link (unless dismissed)
  if (isPublicDemo) {
    if (bannerDismissed) return null

    return (
      <div
        style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          borderRadius: '10px',
          background: 'rgba(99, 102, 241, 0.92)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: '600',
          fontFamily: 'system-ui, sans-serif',
          zIndex: 99998,
          pointerEvents: 'auto',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <button
          onClick={dismissBanner}
          title="Dismiss banner"
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '4px',
            color: '#fff',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '12px',
            lineHeight: 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.15)' }}
        >
          ✕
        </button>
        <span>🚀</span>
        <span>Live Demo — no real agents running</span>
        <a
          href="https://crewhub.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#fff',
            textDecoration: 'none',
            padding: '3px 10px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.2)',
            fontSize: '11px',
            fontWeight: '700',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.2)' }}
        >
          Website →
        </a>
        <a
          href="https://github.com/EKINSOL-DEV/crewhub"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#fff',
            textDecoration: 'none',
            padding: '3px 10px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.2)',
            fontSize: '11px',
            fontWeight: '700',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.2)' }}
        >
          GitHub →
        </a>
      </div>
    )
  }

  // Internal demo mode: show the existing indicator
  if (!isDemoMode) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        padding: '6px 14px',
        borderRadius: '8px',
        background: 'rgba(234, 88, 12, 0.9)',
        color: '#fff',
        fontSize: '12px',
        fontWeight: '600',
        fontFamily: 'system-ui, sans-serif',
        zIndex: 99998,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        animation: 'demo-pulse 2s ease-in-out infinite',
      }}
    >
      <span>🎬</span>
      <span>Demo Mode</span>
      <span style={{ fontSize: '10px', opacity: 0.7 }}>F5 to exit</span>
      <style>{`
        @keyframes demo-pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
