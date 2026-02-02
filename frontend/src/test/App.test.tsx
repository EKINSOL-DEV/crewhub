import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { act } from 'react'
import App from '../App'

// Mock all hooks that make API calls
vi.mock('../hooks/useMinionsStream', () => ({
  useMinionsStream: () => ({
    sessions: [],
    loading: false,
    error: null,
    connected: true,
    connectionMethod: 'sse',
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useAgentsRegistry', () => ({
  useAgentsRegistry: () => ({
    agents: [],
    pinnedAgents: [],
    isLoading: false,
    error: null,
    streamConnected: true,
    refresh: vi.fn(),
    togglePin: vi.fn(),
  }),
}))

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [
      { id: 'default', name: 'Default Room', icon: '🏠', color: '#4f46e5', sort_order: 0, created_at: Date.now(), updated_at: Date.now() }
    ],
    sessionAssignments: new Map(),
    getRoomForSession: () => undefined,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

describe('App', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the ClawCrew header', async () => {
    await act(async () => {
      render(<App />)
    })
    expect(screen.getByText('ClawCrew')).toBeInTheDocument()
  })

  it('renders the tagline', async () => {
    await act(async () => {
      render(<App />)
    })
    expect(screen.getByText('Multi-agent orchestration')).toBeInTheDocument()
  })

  it('shows connected status when connected', async () => {
    await act(async () => {
      render(<App />)
    })
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders the crab emoji logo', async () => {
    await act(async () => {
      render(<App />)
    })
    const crabs = screen.getAllByText('🦀')
    expect(crabs.length).toBeGreaterThan(0)
  })
})
