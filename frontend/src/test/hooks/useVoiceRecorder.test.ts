import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { formatDuration, useVoiceRecorder } from '@/hooks/useVoiceRecorder'

class MockMediaRecorder {
  static isTypeSupported = vi.fn((type: string) => type.includes('webm'))

  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null

  start = vi.fn(() => {
    this.state = 'recording'
  })

  stop = vi.fn(() => {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent)
    this.onstop?.()
  })
}

describe('useVoiceRecorder', () => {
  const mockGetUserMedia = vi.fn()
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).MediaRecorder = MockMediaRecorder
    ;(globalThis as any).fetch = mockFetch

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      configurable: true,
    })
  })

  it('records, uploads and stages pending audio, then confirms', async () => {
    const stream = { getTracks: () => [{ stop: vi.fn() }] }
    mockGetUserMedia.mockResolvedValue(stream)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/audio/1.webm', transcript: 'hello', transcriptError: null }),
    })

    const onAudioReady = vi.fn()
    const { result } = renderHook(() => useVoiceRecorder(onAudioReady))

    await act(async () => {
      await result.current.startRecording()
    })

    await act(async () => {
      result.current.stopRecording()
    })

    await waitFor(() => {
      expect(result.current.pendingAudio?.url).toBe('/audio/1.webm')
    })
    expect(onAudioReady).not.toHaveBeenCalled()

    act(() => {
      result.current.confirmAudio()
    })

    expect(onAudioReady).toHaveBeenCalledTimes(1)
    expect(onAudioReady.mock.calls[0][0]).toBe('/audio/1.webm')
    expect(result.current.pendingAudio).toBeNull()
  })

  it('stopAndSend sends immediately and does not keep pending audio', async () => {
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/audio/2.webm', transcript: null, transcriptError: null }),
    })

    const onAudioReady = vi.fn()
    const { result } = renderHook(() => useVoiceRecorder(onAudioReady))

    await act(async () => {
      await result.current.startRecording()
      result.current.stopAndSend()
    })

    await waitFor(() => {
      expect(onAudioReady).toHaveBeenCalledTimes(1)
    })
    expect(result.current.pendingAudio).toBeNull()
  })

  it('shows microphone permission error', async () => {
    const err = new Error('denied') as Error & { name: string }
    err.name = 'NotAllowedError'
    mockGetUserMedia.mockRejectedValue(err)

    const { result } = renderHook(() => useVoiceRecorder(vi.fn()))

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.error).toBe('Microphone permission denied')
    expect(result.current.isRecording).toBe(false)
  })

  it('formats duration as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
  })
})
