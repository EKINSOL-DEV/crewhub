/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const subscribeMock = vi.fn()
const getMock = vi.fn()
const setMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

vi.mock('@/lib/api', () => ({
  API_BASE: '/api',
  sessionDisplayNameApi: {
    get: getMock,
    set: setMock,
    delete: deleteMock,
  },
}))

describe('useSessionDisplayNames hooks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        display_names: [
          { session_key: 's1', display_name: 'Alice' },
          { session_key: 's2', display_name: 'Bob' },
        ],
      }),
    })
  })

  it('loads bulk display names and updates single hook values', async () => {
    const mod = await import('../../hooks/useSessionDisplayNames')

    const { result } = renderHook(() => mod.useSessionDisplayName('s1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.displayName).toBe('Alice')
    expect(subscribeMock).toHaveBeenCalledWith('display-name-updated', expect.any(Function))

    setMock.mockResolvedValueOnce({})
    await act(async () => {
      const ok = await result.current.update('Alicia')
      expect(ok).toBe(true)
    })
    expect(result.current.displayName).toBe('Alicia')

    deleteMock.mockResolvedValueOnce({})
    await act(async () => {
      const ok = await result.current.remove()
      expect(ok).toBe(true)
    })
    expect(result.current.displayName).toBe(null)

    getMock.mockResolvedValueOnce({ display_name: 'Refreshed' })
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.displayName).toBe('Refreshed')
  })

  it('useSessionDisplayNames returns map for multiple keys and reacts to SSE updates', async () => {
    const sseHandlers = new Map<string, (e: MessageEvent) => void>()
    subscribeMock.mockImplementation((event: string, h: (e: MessageEvent) => void) => {
      sseHandlers.set(event, h)
      return vi.fn()
    })

    const mod = await import('../../hooks/useSessionDisplayNames')

    const { result } = renderHook(() => mod.useSessionDisplayNames(['s1', 's2', 'missing']))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.displayNames.get('s1')).toBe('Alice')
    expect(result.current.displayNames.get('s2')).toBe('Bob')
    expect(result.current.displayNames.get('missing')).toBe(null)

    act(() => {
      sseHandlers.get('display-name-updated')!({
        data: JSON.stringify({ session_key: 'missing', display_name: 'Now named', action: 'set' }),
      } as MessageEvent)
    })

    await waitFor(() => {
      expect(result.current.displayNames.get('missing')).toBe('Now named')
    })
  })

  it('returns false on set/delete failures and refresh handles api failure', async () => {
    const mod = await import('../../hooks/useSessionDisplayNames')
    const { result } = renderHook(() => mod.useSessionDisplayName('s1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    setMock.mockRejectedValueOnce(new Error('boom'))
    deleteMock.mockRejectedValueOnce(new Error('boom'))
    getMock.mockRejectedValueOnce(new Error('boom'))

    await act(async () => {
      expect(await result.current.update('x')).toBe(false)
      expect(await result.current.remove()).toBe(false)
      await result.current.refresh()
    })

    expect(result.current.displayName).toBe(null)
  })
})
