/**
 * AudioMessage – compact audio player for voice messages in chat bubbles.
 *
 * Renders: play/pause button + progress bar + elapsed/total time
 * Uses HTML5 <audio> element underneath, styled to match chat variants.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioMessageProps {
  readonly url: string
  readonly duration?: number
  /** Visual variant to match parent chat bubble */
  readonly variant?: 'zen' | 'float' | 'mobile'
  /** Whether this is a user message (affects color) */
  readonly isUser?: boolean
  readonly accentColor?: string
  /** Whisper transcript (shown below player) */
  readonly transcript?: string
  /** Transcription error message */
  readonly transcriptError?: string
}

export function AudioMessage({
  url,
  duration: initialDuration,
  variant = 'float',
  isUser = false,
  accentColor = '#8b5cf6',
  transcript,
  transcriptError,
}: AudioMessageProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(initialDuration ?? 0)
  const [isLoaded, setIsLoaded] = useState(false)

  // Sync state with audio element events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => {
      if (isFinite(audio.duration)) setTotalDuration(audio.duration)
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (audio) audio.currentTime = 0
    }
    const onCanPlay = () => setIsLoaded(true)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      void audio.play()
    }
  }, [isPlaying])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || !isLoaded) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      audio.currentTime = ratio * (isFinite(audio.duration) ? audio.duration : 0)
    },
    [isLoaded]
  )

  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0

  // ── Style variables based on variant ──────────────────────────
  const isDark = variant === 'mobile'
  const isZen = variant === 'zen'

  let containerBg: string
  if (isUser) {
    containerBg = 'transparent'
  } else if (isDark) {
    containerBg = 'rgba(255,255,255,0.08)'
  } else if (isZen) {
    containerBg = 'rgba(255,255,255,0.06)'
  } else {
    containerBg = 'rgba(0,0,0,0.06)'
  }

  let textColor: string
  if (isUser) {
    textColor = 'rgba(255,255,255,0.9)'
  } else if (isDark) {
    textColor = '#e2e8f0'
  } else if (isZen) {
    textColor = 'var(--zen-fg, #e2e8f0)'
  } else {
    textColor = '#374151'
  }

  let trackBg: string
  if (isUser) {
    trackBg = 'rgba(255,255,255,0.3)'
  } else if (isDark) {
    trackBg = 'rgba(255,255,255,0.15)'
  } else if (isZen) {
    trackBg = 'rgba(255,255,255,0.1)'
  } else {
    trackBg = 'rgba(0,0,0,0.12)'
  }

  const fillColor = isUser ? '#fff' : accentColor

  let btnBg: string
  if (isUser) {
    btnBg = 'rgba(255,255,255,0.25)'
  } else if (isDark) {
    btnBg = 'rgba(255,255,255,0.1)'
  } else if (isZen) {
    btnBg = 'rgba(255,255,255,0.08)'
  } else {
    btnBg = `${accentColor}20`
  }

  const btnColor = isUser ? '#fff' : accentColor

  // ── Formatted times ────────────────────────────────────────────
  const fmt = (s: number) => {
    const sec = Math.floor(s)
    const m = Math.floor(sec / 60)
    const ss = sec % 60
    return `${m}:${ss.toString().padStart(2, '0')}`
  }

  const displayTime = isPlaying || currentTime > 0 ? fmt(currentTime) : fmt(totalDuration)

  // Transcript text color
  let transcriptColor: string
  if (isUser) {
    transcriptColor = 'rgba(255,255,255,0.75)'
  } else if (isDark) {
    transcriptColor = 'rgba(226,232,240,0.65)'
  } else if (isZen) {
    transcriptColor = 'rgba(226,232,240,0.6)'
  } else {
    transcriptColor = 'rgba(55,65,81,0.65)'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 12,
        background: containerBg,
        minWidth: 180,
        maxWidth: 280,
        userSelect: 'none',
      }}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={url} preload="metadata" style={{ display: 'none' }} />

      {/* Player row: button + progress + waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: btnBg,
            color: btnColor,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 13,
            transition: 'background 0.15s',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Progress bar + time */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Progress track */}
          <div
            onClick={handleSeek}
            style={{
              height: 4,
              borderRadius: 2,
              background: trackBg,
              cursor: isLoaded ? 'pointer' : 'default',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${progress * 100}%`,
                background: fillColor,
                borderRadius: 2,
                transition: 'width 0.1s linear',
              }}
            />
          </div>

          {/* Time */}
          <div
            style={{
              fontSize: 10,
              color: textColor,
              opacity: 0.7,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {displayTime}
          </div>
        </div>

        {/* Waveform icon (decorative) */}
        <div
          style={{
            fontSize: 14,
            opacity: isPlaying ? 1 : 0.4,
            color: fillColor,
            flexShrink: 0,
            transition: 'opacity 0.2s',
            animation: isPlaying ? 'audio-wave 0.8s ease infinite alternate' : 'none',
          }}
        >
          🎵
        </div>
      </div>

      {/* Transcript line */}
      {transcript && (
        <div
          style={{
            fontSize: 11,
            fontStyle: 'italic',
            color: transcriptColor,
            lineHeight: 1.4,
            paddingTop: 2,
            borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          {transcript}
        </div>
      )}

      {/* Transcription error */}
      {transcriptError && (
        <div
          style={{
            fontSize: 10,
            color: transcriptColor,
            opacity: 0.65,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingTop: 2,
          }}
        >
          <span>⚠️</span>
          <span>{transcriptError}</span>
        </div>
      )}

      <style>{`
        @keyframes audio-wave {
          from { opacity: 0.5; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
