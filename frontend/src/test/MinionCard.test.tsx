import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MinionCard } from '../components/minions/MinionCard'
import type { MinionSession } from '../lib/api'

// Mock the session display name hook
vi.mock('../hooks/useSessionDisplayNames', () => ({
  useSessionDisplayName: () => ({
    displayName: null,
    loading: false,
    setDisplayName: vi.fn(),
  }),
}))

const createMockSession = (overrides: Partial<MinionSession> = {}): MinionSession => ({
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

describe('MinionCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders session name', () => {
    const session = createMockSession({ key: 'agent:main:main' })
    render(<MinionCard session={session} />)
    // Main Agent appears in h3 and badge, use getAllByText
    const elements = screen.getAllByText('Main Agent')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('shows active status for recent session', () => {
    const session = createMockSession({ updatedAt: Date.now() })
    render(<MinionCard session={session} />)
    // Status indicator shows in multiple places, verify at least one exists
    const elements = screen.getAllByText(/🟢/)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('shows sleeping status for old session', () => {
    const session = createMockSession({ updatedAt: Date.now() - 60 * 60 * 1000 }) // 1 hour ago
    render(<MinionCard session={session} />)
    // Sleeping emoji shows in multiple places, verify at least one exists
    const elements = screen.getAllByText(/💤/)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('displays token count', () => {
    const session = createMockSession({ totalTokens: 1500 })
    render(<MinionCard session={session} />)
    expect(screen.getByText('1,500 tokens')).toBeInTheDocument()
  })

  it('shows model name formatted', () => {
    const session = createMockSession({ model: 'anthropic/claude-sonnet-4' })
    render(<MinionCard session={session} />)
    expect(screen.getByText('Sonnet 4')).toBeInTheDocument()
  })

  it('calls onViewLogs when button clicked', () => {
    const onViewLogs = vi.fn()
    const session = createMockSession()
    render(<MinionCard session={session} onViewLogs={onViewLogs} />)
    
    const button = screen.getByRole('button', { name: /logs/i })
    fireEvent.click(button)
    expect(onViewLogs).toHaveBeenCalledTimes(1)
  })

  it('shows correct minion type for cron session', () => {
    const session = createMockSession({ key: 'agent:main:cron:daily-task' })
    render(<MinionCard session={session} />)
    expect(screen.getByText('Cron Worker')).toBeInTheDocument()
  })

  it('shows correct minion type for subagent', () => {
    const session = createMockSession({ key: 'agent:main:subagent:abc123' })
    render(<MinionCard session={session} />)
    expect(screen.getByText('Subagent')).toBeInTheDocument()
  })
})
