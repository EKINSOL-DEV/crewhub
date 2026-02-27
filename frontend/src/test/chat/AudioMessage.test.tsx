import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AudioMessage } from '@/components/chat/AudioMessage'

describe('AudioMessage', () => {
  const playMock = vi.fn().mockResolvedValue(undefined)
  const pauseMock = vi.fn()

  beforeEach(() => {
    playMock.mockClear()
    pauseMock.mockClear()

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
      configurable: true,
      get: () => 120,
    })
  })

  it('renders transcript and toggles play state', () => {
    const { container } = render(
      <AudioMessage
        url="https://example.com/a.webm"
        duration={65}
        transcript="hello world"
        transcriptError="whisper failed"
      />
    )

    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(screen.getByText('whisper failed')).toBeInTheDocument()

    const btn = screen.getByTitle('Play')
    fireEvent.click(btn)
    expect(playMock).toHaveBeenCalled()

    const audio = container.querySelector('audio') as HTMLAudioElement
    fireEvent(audio, new Event('play'))
    expect(screen.getByTitle('Pause')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Pause'))
    expect(pauseMock).toHaveBeenCalled()
  })

  it('supports seek via click and keyboard after load', () => {
    const { container } = render(
      <AudioMessage url="u" duration={100} isUser accentColor="#ff0000" />
    )

    const audio = container.querySelector('audio') as HTMLAudioElement
    const slider = screen.getByRole('slider', { name: 'Seek audio' })

    Object.defineProperty(slider, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 200 }),
    })

    fireEvent(audio, new Event('canplay'))
    fireEvent.click(slider, { clientX: 100 })
    expect(audio.currentTime).toBe(60)

    audio.currentTime = 40
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(audio.currentTime).toBe(45)

    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(audio.currentTime).toBe(40)
  })
})
