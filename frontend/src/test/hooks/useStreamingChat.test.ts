/* eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useStreamingChat } from '@/hooks/useStreamingChat'

const { subscribeMock, streamMessageMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(() => vi.fn()),
  streamMessageMock: vi.fn(),
}))

vi.mock('@/lib/sseManager', () => ({
  sseManager: {
    subscribe: subscribeMock,
  },
}))

vi.mock('@/services/chatStreamService', () => ({
  streamMessage: streamMessageMock,
}))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useStreamingChat', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).fetch = fetchMock

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [], hasMore: false }),
    })
  })

  it('loads initial history', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messages: [{ id: 'm1', role: 'assistant', content: 'hi', timestamp: Date.now() }],
        hasMore: true,
      }),
    })

    const { result } = renderHook(() => useStreamingChat('agent:main:main'))

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1)
    })
    expect(result.current.hasMore).toBe(true)
    expect(subscribeMock).toHaveBeenCalledWith('session-updated', expect.any(Function))
  })

  it('streams chunks into assistant message and marks done', async () => {
    streamMessageMock.mockImplementation((_sessionKey, _text, _roomId, callbacks) => {
      callbacks.onChunk('Hello')
      callbacks.onChunk(' world')
      return new AbortController()
    })

    const { result } = renderHook(() => useStreamingChat('agent:main:main'))

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    act(() => {
      result.current.sendMessage('Ping')
    })

    await sleep(120)

    expect(result.current.messages.some((m) => m.role === 'user' && m.content === 'Ping')).toBe(
      true
    )
    expect(
      result.current.messages.some((m) => m.role === 'assistant' && m.content === 'Hello world')
    ).toBe(true)

    act(() => {
      const callbacks = streamMessageMock.mock.calls[0][3]
      callbacks.onDone()
    })

    await waitFor(() => {
      expect(result.current.isSending).toBe(false)
      expect(result.current.streamingMessageId).toBeNull()
    })
  })

  it('falls back to blocking send when stream errors', async () => {
    streamMessageMock.mockImplementation((_sessionKey, _text, _roomId, callbacks) => {
      callbacks.onError('stream-failed')
      return new AbortController()
    })

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [], hasMore: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, response: 'fallback response' }),
      })

    const { result } = renderHook(() => useStreamingChat('agent:main:main'))

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    act(() => {
      result.current.sendMessage('Hello')
    })

    await waitFor(() => {
      expect(result.current.messages.some((m) => m.content === 'fallback response')).toBe(true)
      expect(result.current.isSending).toBe(false)
    })
  })
})
