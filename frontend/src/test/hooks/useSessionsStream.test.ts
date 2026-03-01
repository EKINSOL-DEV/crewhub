import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionsStream } from '@/hooks/useSessionsStream'

const mocks = vi.hoisted(() => ({
  mockGetSessions: vi.fn(),
  mockSubscribe: vi.fn(),
  mockOnStateChange: vi.fn(),
}))

let stateListener: ((s: 'disconnected' | 'connecting' | 'connected') => void) | null = null
const eventHandlers = new Map<string, (e: MessageEvent) => void>()

vi.mock('@/lib/api', () => ({
  api: {
    getSessions: mocks.mockGetSessions,
  },
}))

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: mocks.mockSubscribe,
    onStateChange: mocks.mockOnStateChange,
  },
}))

describe('useSessionsStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventHandlers.clear()
    stateListener = null

    mocks.mockSubscribe.mockImplementation(
      (eventType: string, handler: (e: MessageEvent) => void) => {
        eventHandlers.set(eventType, handler)
        return () => eventHandlers.delete(eventType)
      }
    )

    mocks.mockOnStateChange.mockImplementation((cb: typeof stateListener) => {
      stateListener = cb
      cb?.('disconnected')
      return () => {
        stateListener = null
      }
    })
  })

  it('loads initial sessions and handles state transitions', async () => {
    mocks.mockGetSessions.mockResolvedValue({
      sessions: [{ key: 's1', updatedAt: 1, totalTokens: 3 }],
    })

    const { result } = renderHook(() => useSessionsStream(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.connectionMethod).toBe('disconnected')

    act(() => stateListener?.('connected'))

    await waitFor(() => {
      expect(result.current.connected).toBe(true)
      expect(result.current.connectionMethod).toBe('sse')
    })
  })

  it('applies SSE session events', async () => {
    vi.useFakeTimers()
    mocks.mockGetSessions.mockResolvedValue({
      sessions: [{ key: 's1', updatedAt: 1, totalTokens: 1 }],
    })

    const { result } = renderHook(() => useSessionsStream(true))
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      eventHandlers.get('session-created')?.({
        data: JSON.stringify({ key: 's2', updatedAt: 2, totalTokens: 5 }),
      } as MessageEvent)
    })
    expect(result.current.sessions.map((s) => s.key)).toEqual(['s1', 's2'])

    // session-updated is throttled (100ms debounce), so advance timers to flush
    act(() => {
      eventHandlers.get('session-updated')?.({
        data: JSON.stringify({ key: 's2', updatedAt: 9, totalTokens: 99 }),
      } as MessageEvent)
    })
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.sessions.find((s) => s.key === 's2')?.totalTokens).toBe(99)

    act(() => {
      eventHandlers.get('session-removed')?.({
        data: JSON.stringify({ key: 's1' }),
      } as MessageEvent)
    })
    expect(result.current.sessions.map((s) => s.key)).toEqual(['s2'])

    act(() => {
      eventHandlers.get('sessions-refresh')?.({
        data: JSON.stringify({ sessions: [{ key: 'sx', updatedAt: 7, totalTokens: 8 }] }),
      } as MessageEvent)
    })
    expect(result.current.sessions.map((s) => s.key)).toEqual(['sx'])

    vi.useRealTimers()
  })

  it('sets error when fetch fails', async () => {
    mocks.mockGetSessions.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useSessionsStream(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Failed to load crew')
    })
  })

  it('stays disconnected and skips fetch when disabled', async () => {
    const { result } = renderHook(() => useSessionsStream(false))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mocks.mockGetSessions).not.toHaveBeenCalled()
    expect(result.current.connectionMethod).toBe('disconnected')
    expect(result.current.sessions).toEqual([])
  })
})
