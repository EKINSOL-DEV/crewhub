import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

// Mock the hooks
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

describe('App', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  it('renders the ClawCrew header', () => {
    render(<App />)
    expect(screen.getByText('ClawCrew')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<App />)
    expect(screen.getByText('Multi-agent orchestration')).toBeInTheDocument()
  })

  it('shows connected status when connected', () => {
    render(<App />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders the crab emoji logo', () => {
    render(<App />)
    const crabs = screen.getAllByText('🦀')
    expect(crabs.length).toBeGreaterThan(0)
  })
})
