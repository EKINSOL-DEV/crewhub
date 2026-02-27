import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: vi.fn(),
  },
}))

describe('activityService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    ;(globalThis as any).fetch = vi.fn()
  })

  it('fetchSessionHistory parses messages and uses cache', async () => {
    const { fetchSessionHistory, clearActivityCache } =
      await import('../../services/activityService')

    const fetchMock = globalThis.fetch as any
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            timestamp: '2026-01-01T00:00:00.000Z',
            message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
          },
          {
            timestamp: '2026-01-01T00:00:01.000Z',
            message: {
              role: 'assistant',
              content: [{ type: 'toolCall', name: 'exec', arguments: { command: 'ls -la' } }],
            },
          },
          {
            timestamp: '2026-01-01T00:00:02.000Z',
            message: { role: 'toolResult', toolName: 'exec', content: [] },
          },
        ],
      }),
    })

    clearActivityCache()
    const first = await fetchSessionHistory('abc')
    const second = await fetchSessionHistory('abc')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.messages).toHaveLength(3)
    expect(first.messages[0]).toMatchObject({ role: 'assistant', content: 'hello' })
    expect(first.messages[1].tools?.[0].name).toBe('exec')
    expect(first.messages[2]).toMatchObject({ role: 'tool', content: '[exec result]' })
    expect(second).toBe(first)
  })

  it('fetchActivityEntries humanizes tool/text/thinking and returns [] on error', async () => {
    const { fetchActivityEntries } = await import('../../services/activityService')
    const fetchMock = globalThis.fetch as any

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [
          {
            message: {
              role: 'assistant',
              timestamp: 1,
              content: [
                { type: 'toolCall', name: 'read', arguments: { path: '/tmp/a.txt' } },
                { type: 'text', text: 'Some assistant output' },
                { type: 'thinking', thinking: 'internal thoughts' },
              ],
            },
          },
          {
            message: {
              role: 'toolResult',
              timestamp: 2,
              toolName: 'read',
              isError: false,
              content: [],
            },
          },
        ],
      }),
    })

    const entries = await fetchActivityEntries('sess')
    expect(entries.length).toBeGreaterThanOrEqual(4)
    expect(entries[0]).toMatchObject({
      type: 'tool_call',
      description: 'Reading a.txt',
      sessionKey: 'sess',
    })
    expect(entries.some((e) => e.type === 'message')).toBe(true)
    expect(entries.some((e) => e.type === 'thinking')).toBe(true)
    expect(
      entries.some((e) => e.type === 'tool_result' && e.description.includes('✓ read done'))
    ).toBe(true)

    fetchMock.mockRejectedValueOnce(new Error('network'))
    const fallback = await fetchActivityEntries('sess')
    expect(fallback).toEqual([])
  })

  it('subscribeToActivityUpdates invalidates cache and triggers callback on matching session', async () => {
    const { sseManager } = await import('@/lib/sseManager')
    const subscribeMock = sseManager.subscribe as any
    let handler: ((e: MessageEvent) => void) | undefined
    subscribeMock.mockImplementation((_type: string, h: (e: MessageEvent) => void) => {
      handler = h
      return vi.fn()
    })

    const { fetchSessionHistory, subscribeToActivityUpdates } =
      await import('../../services/activityService')
    const fetchMock = globalThis.fetch as any

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })

    await fetchSessionHistory('k1') // cached
    const cb = vi.fn()
    const unsub = subscribeToActivityUpdates('k1', cb)

    handler?.({ data: JSON.stringify({ sessions: [{ key: 'k1' }] }) } as MessageEvent)

    expect(cb).toHaveBeenCalledTimes(1)
    await fetchSessionHistory('k1') // should refetch due cache invalidation
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(typeof unsub).toBe('function')
  })
})
