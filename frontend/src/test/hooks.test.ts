/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock fetch globally
const mockFetch = vi.fn()
;(globalThis as { fetch: typeof fetch }).fetch = mockFetch

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()
  addEventListener = vi.fn()

  triggerOpen() {
    this.onopen?.()
  }

  triggerError() {
    this.onerror?.()
  }
}

const mockEventSource = vi.fn(() => new MockEventSource())
;(globalThis as unknown as { EventSource: typeof EventSource }).EventSource =
  mockEventSource as unknown as typeof EventSource

describe('useSessionsStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('starts with loading state', async () => {
    const { useSessionsStream } = await import('../hooks/useSessionsStream')

    const { result } = renderHook(() => useSessionsStream(false))
    expect(result.current.loading).toBe(false)
    expect(result.current.sessions).toEqual([])
  })

  it('returns disconnected state when disabled', async () => {
    const { useSessionsStream } = await import('../hooks/useSessionsStream')

    const { result } = renderHook(() => useSessionsStream(false))
    expect(result.current.connected).toBe(false)
    expect(result.current.connectionMethod).toBe('disconnected')
  })
})

describe('sessionUtils', () => {
  it('formats model names correctly', async () => {
    const { formatModel } = await import('../lib/minionUtils')

    expect(formatModel('anthropic/claude-sonnet-4-20250514')).toBe('Sonnet 4-20250514')
    expect(formatModel('openai/gpt-4')).toBe('gpt-4')
    expect(formatModel('claude-opus-4')).toBe('Opus 4')
  })

  it('calculates session status correctly', async () => {
    const { getSessionStatus } = await import('../lib/minionUtils')

    // Active: updated within 5 minutes
    expect(getSessionStatus({ updatedAt: Date.now() } as any)).toBe('active')

    // Idle: updated 10 minutes ago
    expect(getSessionStatus({ updatedAt: Date.now() - 10 * 60 * 1000 } as any)).toBe('idle')

    // Sleeping: updated 1 hour ago
    expect(getSessionStatus({ updatedAt: Date.now() - 60 * 60 * 1000 } as any)).toBe('sleeping')
  })

  it('formats time ago correctly', async () => {
    const { timeAgo } = await import('../lib/minionUtils')

    expect(timeAgo(Date.now() - 5000)).toBe('Just now')
    expect(timeAgo(Date.now() - 30000)).toBe('30s ago')
    expect(timeAgo(Date.now() - 120000)).toBe('2m ago')
    expect(timeAgo(Date.now() - 7200000)).toBe('2h ago')
    expect(timeAgo(Date.now() - 172800000)).toBe('2d ago')
  })
})
