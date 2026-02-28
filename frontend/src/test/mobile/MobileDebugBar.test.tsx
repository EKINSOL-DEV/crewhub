/**
 * MobileDebugBar Tests
 * Tests for the bottom debug strip that shows SSE state, API URL, and Tauri info
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileDebugBar } from '@/components/mobile/MobileDebugBar'

// ── Mocks ─────────────────────────────────────────────────────────────────

let mockSSEState: string = 'connected'

vi.mock('@/hooks/useSSEStatus', () => ({
  useSSEStatus: () => mockSSEState,
}))

vi.mock('@/lib/api', () => ({
  API_BASE: 'http://localhost:8091/api',
}))

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MobileDebugBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSSEState = 'connected'
    // Clear Tauri globals
    ;(window as any).__TAURI_INTERNALS__ = undefined
    ;(window as any).__TAURI__ = undefined
  })

  describe('visibility', () => {
    it('renders nothing when enabled=false', () => {
      const { container } = render(<MobileDebugBar enabled={false} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders debug bar when enabled=true', () => {
      const { container } = render(<MobileDebugBar enabled={true} />)
      expect(container.firstChild).not.toBeNull()
    })
  })

  describe('SSE status display', () => {
    it('shows SSE: connected when connected', () => {
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('SSE: connected')).toBeInTheDocument()
    })

    it('shows SSE: connecting when connecting', () => {
      mockSSEState = 'connecting'
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('SSE: connecting')).toBeInTheDocument()
    })

    it('shows SSE: disconnected when disconnected', () => {
      mockSSEState = 'disconnected'
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('SSE: disconnected')).toBeInTheDocument()
    })

    it('shows filled dot icon for connected state', () => {
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('●')).toBeInTheDocument()
    })

    it('shows hollow dot icon for disconnected state', () => {
      mockSSEState = 'disconnected'
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('○')).toBeInTheDocument()
    })

    it('shows dashed dot icon for connecting state', () => {
      mockSSEState = 'connecting'
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('◌')).toBeInTheDocument()
    })
  })

  describe('API URL', () => {
    it('shows API base URL', () => {
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('API: http://localhost:8091/api')).toBeInTheDocument()
    })
  })

  describe('Tauri detection', () => {
    it('shows "Tauri: no" in non-Tauri environment', () => {
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('Tauri: no')).toBeInTheDocument()
    })

    it('shows "Tauri: yes" when __TAURI_INTERNALS__ is present', () => {
      ;(window as any).__TAURI_INTERNALS__ = {}
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('Tauri: yes')).toBeInTheDocument()
    })

    it('shows "Tauri: yes" when __TAURI__ is present', () => {
      ;(window as any).__TAURI__ = {}
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('Tauri: yes')).toBeInTheDocument()
    })
  })

  describe('version', () => {
    it('shows app version', () => {
      render(<MobileDebugBar enabled={true} />)
      expect(screen.getByText('v0.12.0')).toBeInTheDocument()
    })
  })
})
