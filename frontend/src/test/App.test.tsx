/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from '@/App'

let mobile = false
let sessions: any[] = []
let connected = true
let loading = false
let error: string | null = null

vi.mock('@/hooks/useMobile', () => ({ useMobile: () => mobile }))
vi.mock('@/lib/notificationManager', () => ({
  notificationManager: { init: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() },
}))
vi.mock('@/hooks/useSessionsStream', () => ({
  useSessionsStream: () => ({
    sessions,
    loading,
    error,
    connected,
    connectionMethod: 'sse',
    refresh: vi.fn(),
  }),
}))

vi.mock('@/components/world3d/ZoneRenderer', () => ({
  ZoneRenderer: () => <div>Zone Renderer</div>,
}))

vi.mock('@/components/sessions/AllSessionsView', () => ({
  AllSessionsView: () => <div>All View</div>,
}))
vi.mock('@/components/sessions/CardsView', () => ({ CardsView: () => <div>Cards View</div> }))
vi.mock('@/components/sessions/CronView', () => ({ CronView: () => <div>Cron View</div> }))
vi.mock('@/components/sessions/HistoryView', () => ({ HistoryView: () => <div>History View</div> }))
vi.mock('@/components/sessions/StatsHeader', () => ({ StatsHeader: () => <div>Stats</div> }))
vi.mock('@/components/sessions/SettingsPanel', () => ({
  DEFAULT_SETTINGS: {},
  SettingsPanel: () => null,
}))
vi.mock('@/components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => children }))
vi.mock('@/contexts/ThemeContext', () => ({ ThemeProvider: ({ children }: any) => children }))
vi.mock('@/contexts/ChatContext', () => ({
  ChatProvider: ({ children }: any) => children,
  useChatContext: () => ({ windows: [] }),
}))
vi.mock('@/contexts/RoomsContext', () => ({
  RoomsProvider: ({ children }: any) => children,
  useRoomsContext: () => ({ rooms: [], getRoomForSession: () => undefined }),
}))
vi.mock('@/contexts/DemoContext', () => ({
  DemoProvider: ({ children }: any) => children,
  DemoModeIndicator: () => null,
  useDemoMode: () => ({ isDemoMode: false, demoSessions: [] }),
}))
vi.mock('@/contexts/ZoneContext', () => ({ ZoneProvider: ({ children }: any) => children }))
vi.mock('@/components/mobile/MobileLayout', () => ({
  MobileLayout: () => <div>Mobile Layout</div>,
}))
vi.mock('@/components/SettingsView', () => ({ SettingsView: () => <div>Settings View</div> }))
vi.mock('@/components/AppHealthGate', () => ({ AppHealthGate: ({ children }: any) => children }))
vi.mock('@/components/chat/ChatWindowManager', () => ({ ChatWindowManager: () => null }))
vi.mock('@/components/dev/DevDesigns', () => ({ DevDesigns: () => <div>Dev Designs</div> }))
vi.mock('@/components/dev/BackendStatus', () => ({ BackendStatus: () => null }))
vi.mock('@/components/dev/DevErrorViewer', () => ({ DevToolbar: () => null }))
vi.mock('@/components/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => <div>Onboarding</div>,
}))
vi.mock('@/components/zen', () => ({
  ZenModeProvider: ({ children }: any) => children,
  ZenMode: () => <div>Zen Mode</div>,
  useZenMode: () => ({
    isActive: false,
    selectedAgentId: null,
    selectedAgentName: null,
    selectedAgentIcon: null,
    selectedAgentColor: null,
    projectFilter: null,
    clearProjectFilter: vi.fn(),
    enter: vi.fn(),
    exit: vi.fn(),
    enterWithProject: vi.fn(),
  }),
}))
vi.mock('@/components/zen/ProjectManagerModal', () => ({ ProjectManagerModal: () => null }))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/desktop/DesktopActivityFeed', () => ({
  DesktopActivityFeed: () => null,
  DesktopActivityFeedButton: ({ onClick }: any) => <button onClick={onClick}>Feed</button>,
  useDesktopActivityFeed: () => ({ isOpen: false, toggle: vi.fn(), close: vi.fn() }),
}))
vi.mock('@/contexts/CreatorModeContext', () => ({
  CreatorModeProvider: ({ children }: any) => children,
}))
vi.mock('@/components/MobileWarning', () => ({ MobileWarning: () => null }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<any>('@/lib/api')
  return {
    ...actual,
    getOnboardingStatus: vi.fn().mockResolvedValue({ completed: true, connections_count: 1 }),
  }
})

describe('App routing and shells', () => {
  const originalLocation = window.location

  beforeEach(() => {
    cleanup()
    mobile = false
    sessions = []
    connected = true
    loading = false
    error = null
    localStorage.clear()
    ;(window as any).__TAURI_VIEW__ = undefined
    ;(window as any).__TAURI_INTERNALS__ = undefined
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('renders desktop app shell', async () => {
    render(<App />)
    expect(await screen.findByText('CrewHub')).toBeInTheDocument()
    expect(screen.getByText('Multi-agent orchestration')).toBeInTheDocument()
    expect(screen.getByText('No Active Sessions')).toBeInTheDocument()
  })

  it('routes to dev designs path', () => {
    window.history.pushState({}, '', '/dev/designs')
    render(<App />)
    expect(screen.getByText('Dev Designs')).toBeInTheDocument()
  })

  it('renders tauri settings view', () => {
    ;(window as any).__TAURI_VIEW__ = 'settings'
    render(<App />)
    expect(screen.getByText('Settings View')).toBeInTheDocument()
  })

  it('renders tauri mobile view', () => {
    ;(window as any).__TAURI_VIEW__ = 'mobile'
    render(<App />)
    expect(screen.getByText('Mobile Layout')).toBeInTheDocument()
  })

  it('renders mobile layout when hook reports mobile', () => {
    mobile = true
    render(<App />)
    expect(screen.getByText('Mobile Layout')).toBeInTheDocument()
  })

  it('renders zen mode entry page for mode=zen URL', () => {
    window.history.pushState({}, '', '/?mode=zen')
    render(<App />)
    expect(screen.getByText('⚡ Zen Mode')).toBeInTheDocument()
    expect(screen.getByText(/Enter Zen Mode/)).toBeInTheDocument()
  })
})
