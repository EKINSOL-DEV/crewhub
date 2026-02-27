import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { act } from 'react'
import App from '../App'

// Mock all hooks that make API calls
vi.mock('../hooks/useSessionsStream', () => ({
  useSessionsStream: () => ({
    sessions: [],
    loading: false,
    error: null,
    connected: true,
    connectionMethod: 'sse',
    reconnecting: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useAgentsRegistry', () => ({
  useAgentsRegistry: (_sessions: unknown[]) => ({
    agents: [],
    pinnedAgents: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    togglePin: vi.fn(),
  }),
}))

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [
      {
        id: 'default',
        name: 'Default Room',
        icon: '🏠',
        color: '#4f46e5',
        sort_order: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ],
    sessionAssignments: new Map(),
    getRoomForSession: () => undefined,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('../contexts/ChatContext', () => ({
  ChatProvider: ({ children }: { children: React.ReactNode }) => children,
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

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the CrewHub header', async () => {
    await act(async () => {
      render(<App />)
    })
    expect(screen.getByText('CrewHub')).toBeInTheDocument()
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

  it('renders the team emoji logo', async () => {
    await act(async () => {
      render(<App />)
    })
    const logos = screen.getAllByText('👥')
    expect(logos.length).toBeGreaterThan(0)
  })
})
