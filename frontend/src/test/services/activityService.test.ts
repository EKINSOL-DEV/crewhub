/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('fetchSessionHistory caches and supports tool/use + toolResult fallback', async () => {
    const { fetchSessionHistory, clearActivityCache } =
      await import('../../services/activityService')
    const fetchMock = globalThis.fetch as any

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            timestamp: '2026-01-01T00:00:00.000Z',
            message: { role: 'thinking', content: 'ignored' },
          },
          {
            timestamp: '2026-01-01T00:00:01.000Z',
            message: {
              role: 'assistant',
              content: [{ type: 'tool_use', name: 'exec', input: { command: 'echo hello' } }],
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
    const h1 = await fetchSessionHistory('s1')
    const h2 = await fetchSessionHistory('s1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(h1.messages).toHaveLength(2)
    expect(h1.messages[0].tools?.[0].name).toBe('exec')
    expect(h1.messages[1].content).toBe('[exec result]')
    expect(h2).toBe(h1)

    clearActivityCache('s1')
    await fetchSessionHistory('s1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fetchSessionHistory throws on non-ok response', async () => {
    const { fetchSessionHistory } = await import('../../services/activityService')
    ;(globalThis.fetch as any).mockResolvedValue({ ok: false, status: 503 })
    await expect(fetchSessionHistory('down')).rejects.toThrow('Failed to fetch history: 503')
  })

  it('fetchActivityEntries humanizes many tool labels and tool results', async () => {
    const { fetchActivityEntries } = await import('../../services/activityService')
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [
          {
            message: {
              role: 'assistant',
              timestamp: 1,
              content: [
                { type: 'toolCall', name: 'read', arguments: { file_path: '/tmp/file.txt' } },
                { type: 'toolCall', name: 'write', arguments: { path: '/tmp/out.md' } },
                { type: 'toolCall', name: 'web_search', arguments: {} },
                { type: 'toolCall', name: 'browser', arguments: { action: 'open' } },
                { type: 'toolCall', name: 'process', arguments: {} },
                { type: 'text', text: 'hello world' },
                { type: 'thinking', thinking: 'thinking hard' },
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
          {
            message: {
              role: 'toolResult',
              timestamp: 3,
              toolName: 'write',
              isError: true,
              content: [],
            },
          },
        ],
      }),
    })

    const entries = await fetchActivityEntries('sess-1')
    expect(entries.every((e) => e.sessionKey === 'sess-1')).toBe(true)
    expect(entries.some((e) => e.description === 'Reading file.txt')).toBe(true)
    expect(entries.some((e) => e.description === 'Writing out.md')).toBe(true)
    expect(entries.some((e) => e.description === 'Searching the web')).toBe(true)
    expect(entries.some((e) => e.description === 'Browser: open')).toBe(true)
    expect(entries.some((e) => e.description === 'Managing process')).toBe(true)
    expect(entries.some((e) => e.type === 'message')).toBe(true)
    expect(entries.some((e) => e.type === 'thinking')).toBe(true)
    expect(entries.some((e) => e.description.includes('✓ read done'))).toBe(true)
    expect(entries.some((e) => e.description.includes('❌ write failed'))).toBe(true)
  })

  it('subscribeToActivityUpdates invalidates cache, handles non-match and bad JSON', async () => {
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

    await fetchSessionHistory('abc')
    const cb = vi.fn()
    subscribeToActivityUpdates('abc', cb)

    handler?.({ data: JSON.stringify({ sessions: [{ key: 'other' }] }) } as MessageEvent)
    handler?.({ data: 'not-json' } as MessageEvent)
    expect(cb).not.toHaveBeenCalled()

    handler?.({ data: JSON.stringify({ sessions: [{ key: 'abc' }] }) } as MessageEvent)
    expect(cb).toHaveBeenCalledTimes(1)

    await fetchSessionHistory('abc')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
