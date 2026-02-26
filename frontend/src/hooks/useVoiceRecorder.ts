/**
 * useVoiceRecorder – MediaRecorder-based voice recording hook.
 *
 * Features:
 * - Start/stop recording with mic selection via localStorage
 * - Auto-stop after MAX_DURATION_MS (5 minutes)
 * - Uploads to POST /api/media/audio (auto-transcribed via Groq Whisper)
 * - After upload, sets pendingAudio state instead of sending immediately
 * - Exposes confirmAudio() to send and cancelAudio() to discard
 * - ESC key cancels recording
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { API_BASE } from '@/lib/api'

const MAX_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const MIC_DEVICE_KEY = 'crewhub-mic-device-id'

export interface PendingAudio {
  url: string
  duration: number
  transcript: string | null
  transcriptError: string | null
}

export interface UseVoiceRecorderReturn {
  isRecording: boolean
  isPreparing: boolean
  /** Elapsed seconds while recording */
  duration: number
  error: string | null
  isSupported: boolean
  /** Audio that has been uploaded but not yet sent — null when nothing pending */
  pendingAudio: PendingAudio | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  /** Stop recording AND immediately send (WhatsApp-style, no preview step) */
  stopAndSend: () => void
  cancelRecording: () => void
  /** Send the pending audio via onAudioReady and clear it */
  confirmAudio: () => void
  /** Discard the pending audio without sending */
  cancelAudio: () => void
}

export function useVoiceRecorder(
  onAudioReady: (
    url: string,
    duration: number,
    transcript: string | null,
    transcriptError: string | null
  ) => void
): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const cancelledRef = useRef(false)
  const mimeTypeRef = useRef<string>('audio/webm')
  // sendImmediately: when true, uploadAudio calls onAudioReady directly (skip preview)
  const sendImmediatelyRef = useRef(false)
  // Keep onAudioReady in a ref so uploadAudio can call the latest version
  const onAudioReadyRef = useRef(onAudioReady)
  useEffect(() => {
    onAudioReadyRef.current = onAudioReady
  }, [onAudioReady])

  const isSupported =
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

  // ── Cleanup helper ──────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    mediaRecorderRef.current = null
  }, [])

  // ── Upload audio blob — sets pendingAudio instead of sending ───
  const uploadAudio = useCallback(async (blob: Blob, dur: number) => {
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `voice-${Date.now()}.${ext}`, {
        type: blob.type,
      })
      const formData = new FormData()
      formData.append('file', file)

      const resp = await fetch(`${API_BASE}/media/audio`, {
        method: 'POST',
        body: formData,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(err.detail || `Upload failed (${resp.status})`)
      }

      const data = await resp.json()
      const transcript: string | null = data.transcript ?? null
      const transcriptError: string | null = data.transcriptError ?? null
      const roundedDur = Math.round(dur * 10) / 10

      if (sendImmediatelyRef.current) {
        // WhatsApp-style: send immediately, skip preview
        sendImmediatelyRef.current = false
        onAudioReadyRef.current(data.url, roundedDur, transcript, transcriptError)
        setPendingAudio(null)
      } else {
        // Stage as pending for manual confirm
        setPendingAudio({
          url: data.url,
          duration: roundedDur,
          transcript,
          transcriptError,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    }
  }, [])

  // ── Confirm: send pending audio and clear it ────────────────────
  const confirmAudio = useCallback(() => {
    if (!pendingAudio) return
    onAudioReady(
      pendingAudio.url,
      pendingAudio.duration,
      pendingAudio.transcript,
      pendingAudio.transcriptError
    )
    setPendingAudio(null)
  }, [pendingAudio, onAudioReady])

  // ── Cancel: discard pending audio without sending ───────────────
  const cancelAudio = useCallback(() => {
    setPendingAudio(null)
    setError(null)
  }, [])

  // ── Stop recording (triggers upload → pendingAudio) ─────────────
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    cancelledRef.current = false
    mediaRecorderRef.current.stop()
  }, [])

  // ── Stop + send immediately (WhatsApp-style, no preview) ────────
  const stopAndSend = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    sendImmediatelyRef.current = true
    cancelledRef.current = false
    mediaRecorderRef.current.stop()
  }, [])

  // ── Cancel recording (discards audio entirely) ──────────────────
  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    cleanup()
    setIsRecording(false)
    setIsPreparing(false)
    setDuration(0)
    setError(null)
  }, [cleanup])

  // ── Start recording ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // NOSONAR: complexity from legitimate media recording state machine
    if (!isSupported) {
      setError('Voice recording not supported in this browser')
      return
    }

    setError(null)
    setIsPreparing(true)
    cancelledRef.current = false

    try {
      // Get selected mic (from settings)
      const deviceId = localStorage.getItem(MIC_DEVICE_KEY) || undefined
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      // Pick best supported MIME type
      let mimeType: string
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else {
        mimeType = ''
      }

      mimeTypeRef.current = mimeType || 'audio/webm'

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)

      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const dur = (Date.now() - startTimeRef.current) / 1000
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        })

        cleanup()
        setIsRecording(false)
        setDuration(0)

        if (!cancelledRef.current && blob.size > 0) {
          uploadAudio(blob, dur)
        }
      }

      mr.start(100) // Collect in 100ms chunks
      startTimeRef.current = Date.now()

      setIsPreparing(false)
      setIsRecording(true)

      // Update elapsed timer every 500ms
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        stopRecording()
      }, MAX_DURATION_MS)
    } catch (err: unknown) {
      setIsPreparing(false)
      cleanup()
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission denied')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found')
        } else {
          setError(err.message || 'Could not access microphone')
        }
      } else {
        setError('Could not access microphone')
      }
    }
  }, [isSupported, cleanup, uploadAudio, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      cleanup()
    }
  }, [cleanup])

  return {
    isRecording,
    isPreparing,
    duration,
    error,
    isSupported,
    pendingAudio,
    startRecording,
    stopRecording,
    stopAndSend,
    cancelRecording,
    confirmAudio,
    cancelAudio,
  }
}

/** Format seconds as m:ss */
export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
