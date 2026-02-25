import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionCard } from '../components/sessions/SessionCard'
import type { CrewSession } from '../lib/api'

// Mock the session display name hook
vi.mock('../hooks/useSessionDisplayNames', () => ({
  useSessionDisplayName: () => ({
    displayName: null,
    loading: false,
    setDisplayName: vi.fn(),
  }),
}))

// Mock ChatContext
vi.mock('../contexts/ChatContext', () => ({
  useChatContext: () => ({
    windows: [],
    openChat: vi.fn(),
    closeChat: vi.fn(),
    toggleMinimize: vi.fn(),
    togglePin: vi.fn(),
    moveWindow: vi.fn(),
    resizeWindow: vi.fn(),
    bringToFront: vi.fn(),
  }),
}))

const createMockSession = (overrides: Partial<CrewSession> = {}): CrewSession => ({
  key: 'agent:main:main',
  kind: 'agent',
  channel: 'webchat',
  updatedAt: Date.now(),
  sessionId: 'test-session-id',
  model: 'claude-sonnet-4-20250514',
  totalTokens: 1500,
  messages: [],
  ...overrides,
})

describe('SessionCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders session name', () => {
    const session = createMockSession({ key: 'agent:main:main' })
    render(<SessionCard session={session} />)
    // Main Agent appears in h3 and badge, use getAllByText
    const elements = screen.getAllByText('Main Agent')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('shows active status for recent session', () => {
    const session = createMockSession({ updatedAt: Date.now() })
    render(<SessionCard session={session} />)
    const elements = screen.getAllByText(/🟢/)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('shows sleeping status for old session', () => {
    const session = createMockSession({ updatedAt: Date.now() - 60 * 60 * 1000 })
    render(<SessionCard session={session} />)
    const elements = screen.getAllByText(/💤/)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('displays token count', () => {
    const session = createMockSession({ totalTokens: 1500 })
    render(<SessionCard session={session} />)
    expect(screen.getByText('1,500 tokens')).toBeInTheDocument()
  })

  it('shows model name formatted', () => {
    const session = createMockSession({ model: 'anthropic/claude-sonnet-4' })
    render(<SessionCard session={session} />)
    expect(screen.getByText('Sonnet 4')).toBeInTheDocument()
  })

  it('calls onViewLogs when button clicked', () => {
    const onViewLogs = vi.fn()
    const session = createMockSession()
    render(<SessionCard session={session} onViewLogs={onViewLogs} />)

    const button = screen.getByRole('button', { name: /logs/i })
    fireEvent.click(button)
    expect(onViewLogs).toHaveBeenCalledTimes(1)
  })

  it('shows correct session type for cron session', () => {
    const session = createMockSession({ key: 'agent:main:cron:daily-task' })
    render(<SessionCard session={session} />)
    expect(screen.getByText('Cron Worker')).toBeInTheDocument()
  })

  it('shows correct session type for subagent', () => {
    const session = createMockSession({ key: 'agent:main:subagent:abc123' })
    render(<SessionCard session={session} />)
    expect(screen.getByText('Subagent')).toBeInTheDocument()
  })
})
