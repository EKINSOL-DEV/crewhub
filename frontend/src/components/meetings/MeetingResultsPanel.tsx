/**
 * MeetingResultsPanel — Fullscreen overlay for meeting results.
 *
 * Reuses the same visual pattern as FullscreenOverlay (markdown viewer)
 * for consistency: portal, dark backdrop, header with close, Esc key, body scroll lock.
 * Renders MeetingOutput inside for meeting-specific features.
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MeetingOutput } from './MeetingOutput'
import { useMeetingContext } from '@/contexts/MeetingContext'
import { API_BASE } from '@/lib/api'
import type { MeetingState } from '@/hooks/useMeeting'

export function MeetingResultsPanel() {
  const { sidebarMeetingId, closeSidebar, meeting, openFollowUp } = useMeetingContext()
  const [loadedMeeting, setLoadedMeeting] = useState<MeetingState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable refs to avoid effect re-runs from context object identity changes
  const meetingIdRef = useRef(meeting.meetingId)
  const meetingOutputRef = useRef(meeting.outputMd)
  meetingIdRef.current = meeting.meetingId
  meetingOutputRef.current = meeting.outputMd

  // Load meeting data when sidebarMeetingId changes
  useEffect(() => {
    if (!sidebarMeetingId) {
      setLoadedMeeting(null)
      setError(null)
      return
    }

    // If current meeting matches, use it directly
    if (meetingIdRef.current === sidebarMeetingId && meetingOutputRef.current) {
      setLoadedMeeting({ ...meeting })
      return
    }

    // Otherwise fetch from API
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${API_BASE}/meetings/${sidebarMeetingId}/status`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        setLoadedMeeting({
          phase: 'complete',
          meetingId: data.id,
          title: data.title || 'Meeting Results',
          project_id: data.project_id || undefined,
          participants: data.participants?.map((p: any) => p.agent_id) || [],
          currentRound: data.total_rounds,
          totalRounds: data.total_rounds,
          currentTurnAgentId: null,
          currentTurnAgentName: null,
          progressPct: 100,
          rounds: data.rounds?.map((r: any) => ({
            roundNum: r.round_num,
            topic: r.topic,
            turns: r.turns?.map((t: any, i: number) => ({
              round: r.round_num,
              agentId: t.agent_id,
              agentName: t.agent_name,
              response: t.response,
              turnIndex: i,
              totalTurns: r.turns.length,
              status: 'done' as const,
            })) || [],
            status: 'complete' as const,
          })) || [],
          outputMd: data.output_md,
          outputPath: data.output_path,
          outputLoading: false,
          outputError: null,
          error: null,
          durationSeconds: data.completed_at && data.started_at
            ? (new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()) / 1000
            : null,
          warnings: [],
        })
      })
      .catch(err => {
        if (cancelled) return
        console.error('[MeetingResultsPanel] fetch error:', err)
        setError(err.message || 'Failed to load meeting')
        setLoadedMeeting(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarMeetingId])

  const handleClose = useCallback(() => {
    closeSidebar()
  }, [closeSidebar])

  const handleFollowUp = useCallback(() => {
    if (sidebarMeetingId) {
      openFollowUp(sidebarMeetingId)
      closeSidebar()
    }
  }, [sidebarMeetingId, openFollowUp, closeSidebar])

  // Keyboard: Esc to close
  useEffect(() => {
    if (!sidebarMeetingId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [sidebarMeetingId, handleClose])

  // Lock body scroll + disable canvas pointer events (matches FullscreenOverlay pattern)
  useEffect(() => {
    if (!sidebarMeetingId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const canvases = document.querySelectorAll('canvas')
    const prevPointerEvents: string[] = []
    canvases.forEach((canvas, i) => {
      prevPointerEvents[i] = canvas.style.pointerEvents
      canvas.style.pointerEvents = 'none'
    })

    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))

    const blockIfOutsideOverlay = (e: Event) => {
      const overlayEl = document.querySelector('[data-fullscreen-overlay]')
      if (overlayEl && overlayEl.contains(e.target as Node)) return
      e.stopPropagation()
    }
    document.addEventListener('pointermove', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('pointerup', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('pointerdown', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('wheel', blockIfOutsideOverlay, { capture: true })

    return () => {
      document.body.style.overflow = prev
      canvases.forEach((canvas, i) => {
        canvas.style.pointerEvents = prevPointerEvents[i]
      })
      window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: false } }))
      document.removeEventListener('pointermove', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('pointerup', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('pointerdown', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('wheel', blockIfOutsideOverlay, { capture: true })
    }
  }, [sidebarMeetingId])

  if (!sidebarMeetingId) return null

  const overlay = (
    <div
      data-fullscreen-overlay
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'all',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Content card — matches FullscreenOverlay layout */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        flexDirection: 'column',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'hsl(var(--muted-foreground))',
            fontSize: 14,
          }}>
            Loading meeting results…
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 12,
          }}>
            <span style={{ color: 'hsl(var(--destructive))', fontSize: 14 }}>
              Failed to load meeting: {error}
            </span>
            <button
              onClick={handleClose}
              style={{
                background: 'hsl(var(--secondary))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: 13,
                cursor: 'pointer',
                color: 'hsl(var(--foreground))',
              }}
            >
              Close
            </button>
          </div>
        ) : loadedMeeting ? (
          <MeetingOutput
            meeting={loadedMeeting}
            onClose={handleClose}
            mode="fullscreen"
            onStartFollowUp={handleFollowUp}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'hsl(var(--muted-foreground))',
            fontSize: 14,
          }}>
            Meeting not found
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}
