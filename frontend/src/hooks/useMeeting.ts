/**
 * useMeeting — SSE-driven meeting state management hook.
 *
 * Subscribes to all meeting-* SSE events and exposes the current meeting
 * state to the UI.  Provides actions: startMeeting, cancelMeeting.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { sseManager } from '@/lib/sseManager'
import { API_BASE } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────

export type MeetingPhase =
  | 'idle'
  | 'gathering'
  | 'round'
  | 'synthesizing'
  | 'complete'
  | 'error'
  | 'cancelled'

export interface MeetingTurn {
  round: number
  agentId: string
  agentName: string
  response: string | null
  turnIndex: number
  totalTurns: number
  status: 'waiting' | 'speaking' | 'done' | 'skipped'
}

export interface MeetingRound {
  roundNum: number
  topic: string
  turns: MeetingTurn[]
  status: 'pending' | 'in_progress' | 'complete'
}

export interface MeetingState {
  phase: MeetingPhase
  meetingId: string | null
  title: string
  participants: string[]
  currentRound: number
  totalRounds: number
  currentTurnAgentId: string | null
  currentTurnAgentName: string | null
  progressPct: number
  rounds: MeetingRound[]
  outputMd: string | null
  outputPath: string | null
  outputLoading: boolean
  outputError: string | null
  error: string | null
  durationSeconds: number | null
  warnings: string[]
}

export interface StartMeetingParams {
  title?: string
  goal?: string
  room_id?: string
  project_id?: string
  participants: string[]
  num_rounds?: number
  round_topics?: string[]
  max_tokens_per_turn?: number
  document_path?: string
  document_context?: string
}

const INITIAL_STATE: MeetingState = {
  phase: 'idle',
  meetingId: null,
  title: '',
  participants: [],
  currentRound: 0,
  totalRounds: 0,
  currentTurnAgentId: null,
  currentTurnAgentName: null,
  progressPct: 0,
  rounds: [],
  outputMd: null,
  outputPath: null,
  outputLoading: false,
  outputError: null,
  error: null,
  durationSeconds: null,
  warnings: [],
}

// ─── Hook ───────────────────────────────────────────────────────

export function useMeeting() {
  const [state, setState] = useState<MeetingState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state

  // ─── SSE Event Handlers ─────────────────────────────────────

  useEffect(() => {
    const handleStarted = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setState(prev => ({
          ...prev,
          phase: 'gathering',
          meetingId: data.meeting_id,
          title: data.title || 'Meeting',
          participants: data.participants || [],
          currentRound: 0,
          totalRounds: data.num_rounds || data.total_rounds || 0,
          progressPct: 0,
          rounds: [],
          outputMd: null,
          outputPath: null,
          error: null,
          durationSeconds: null,
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      } catch (e) {
        console.error('Failed to parse meeting-started:', e)
      }
    }

    const handleState = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return

        const stateStr: string = data.state || ''
        let phase: MeetingPhase = 'round'
        if (stateStr === 'gathering') phase = 'gathering'
        else if (stateStr === 'synthesizing') phase = 'synthesizing'
        else if (stateStr === 'complete') phase = 'complete'
        else if (stateStr === 'error') phase = 'error'
        else if (stateStr === 'cancelled') phase = 'cancelled'

        setState(prev => {
          const newRounds = [...prev.rounds]
          // Mark current round topic if we have it
          if (phase === 'round' && data.current_round && data.round_topic) {
            const roundIdx = data.current_round - 1
            if (!newRounds[roundIdx]) {
              newRounds[roundIdx] = {
                roundNum: data.current_round,
                topic: data.round_topic,
                turns: [],
                status: 'in_progress',
              }
            } else {
              newRounds[roundIdx].status = 'in_progress'
              newRounds[roundIdx].topic = data.round_topic
            }
            // Mark previous rounds as complete
            for (let i = 0; i < roundIdx; i++) {
              if (newRounds[i]) newRounds[i].status = 'complete'
            }
          }

          return {
            ...prev,
            phase,
            currentRound: data.current_round ?? prev.currentRound,
            totalRounds: data.total_rounds ?? prev.totalRounds,
            progressPct: data.progress_pct ?? prev.progressPct,
            rounds: newRounds,
          }
        })
      } catch (e) {
        console.error('Failed to parse meeting-state:', e)
      }
    }

    const handleTurnStart = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return

        setState(prev => {
          const newRounds = [...prev.rounds]
          const roundIdx = (data.round || 1) - 1
          if (!newRounds[roundIdx]) {
            newRounds[roundIdx] = {
              roundNum: data.round || 1,
              topic: '',
              turns: [],
              status: 'in_progress',
            }
          }
          // Add or update turn
          const existingIdx = newRounds[roundIdx].turns.findIndex(
            t => t.agentId === data.agent_id && t.round === data.round
          )
          const turn: MeetingTurn = {
            round: data.round || 1,
            agentId: data.agent_id,
            agentName: data.agent_name || data.agent_id,
            response: null,
            turnIndex: data.turn_index ?? 0,
            totalTurns: data.total_turns ?? prev.participants.length,
            status: 'speaking',
          }
          if (existingIdx >= 0) {
            newRounds[roundIdx].turns[existingIdx] = turn
          } else {
            newRounds[roundIdx].turns.push(turn)
          }

          return {
            ...prev,
            phase: 'round',
            currentTurnAgentId: data.agent_id,
            currentTurnAgentName: data.agent_name || data.agent_id,
            rounds: newRounds,
          }
        })
      } catch (e) {
        console.error('Failed to parse meeting-turn-start:', e)
      }
    }

    const handleTurn = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return

        setState(prev => {
          const newRounds = [...prev.rounds]
          const roundIdx = (data.round || 1) - 1
          if (!newRounds[roundIdx]) {
            newRounds[roundIdx] = {
              roundNum: data.round || 1,
              topic: '',
              turns: [],
              status: 'in_progress',
            }
          }
          const existingIdx = newRounds[roundIdx].turns.findIndex(
            t => t.agentId === data.agent_id && t.round === data.round
          )
          const turn: MeetingTurn = {
            round: data.round || 1,
            agentId: data.agent_id,
            agentName: data.agent_name || data.agent_id,
            response: data.response || '(no response — skipped)',
            turnIndex: data.turn_index ?? 0,
            totalTurns: data.total_turns ?? prev.participants.length,
            status: data.response ? 'done' : 'skipped',
          }
          if (existingIdx >= 0) {
            newRounds[roundIdx].turns[existingIdx] = turn
          } else {
            newRounds[roundIdx].turns.push(turn)
          }

          return {
            ...prev,
            progressPct: data.progress_pct ?? prev.progressPct,
            currentTurnAgentId: null,
            currentTurnAgentName: null,
            rounds: newRounds,
          }
        })
      } catch (e) {
        console.error('Failed to parse meeting-turn:', e)
      }
    }

    const handleSynthesis = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return
        setState(prev => ({
          ...prev,
          phase: 'synthesizing',
          progressPct: data.progress_pct ?? 90,
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      } catch (e) {
        console.error('Failed to parse meeting-synthesis:', e)
      }
    }

    const handleComplete = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return
        setState(prev => ({
          ...prev,
          phase: 'complete',
          progressPct: 100,
          outputPath: data.output_path || null,
          durationSeconds: data.duration_seconds || null,
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      } catch (e) {
        console.error('Failed to parse meeting-complete:', e)
      }
    }

    const handleError = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: data.error || 'Unknown error',
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      } catch (e) {
        console.error('Failed to parse meeting-error:', e)
      }
    }

    const handleCancelled = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return
        setState(prev => ({
          ...prev,
          phase: 'cancelled',
          currentTurnAgentId: null,
          currentTurnAgentName: null,
        }))
      } catch (e) {
        console.error('Failed to parse meeting-cancelled:', e)
      }
    }

    const handleWarning = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (stateRef.current.meetingId && data.meeting_id !== stateRef.current.meetingId) return
        setState(prev => ({
          ...prev,
          warnings: [...prev.warnings, data.message || 'Unknown warning'],
        }))
      } catch (e) {
        console.error('Failed to parse meeting-warning:', e)
      }
    }

    const unsubs = [
      sseManager.subscribe('meeting-started', handleStarted),
      sseManager.subscribe('meeting-state', handleState),
      sseManager.subscribe('meeting-turn-start', handleTurnStart),
      sseManager.subscribe('meeting-turn', handleTurn),
      sseManager.subscribe('meeting-synthesis', handleSynthesis),
      sseManager.subscribe('meeting-complete', handleComplete),
      sseManager.subscribe('meeting-error', handleError),
      sseManager.subscribe('meeting-cancelled', handleCancelled),
      sseManager.subscribe('meeting-warning', handleWarning),
    ]

    return () => unsubs.forEach(fn => fn())
  }, [])

  // ─── Actions ────────────────────────────────────────────────

  const startMeeting = useCallback(async (params: StartMeetingParams) => {
    const res = await fetch(`${API_BASE}/meetings/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to start meeting' }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }, [])

  const cancelMeeting = useCallback(async () => {
    const meetingId = stateRef.current.meetingId
    if (!meetingId) return
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/cancel`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to cancel' }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }, [])

  const fetchOutput = useCallback(async () => {
    const meetingId = stateRef.current.meetingId
    if (!meetingId) return null
    setState(prev => ({ ...prev, outputLoading: true, outputError: null }))
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/output`)
      if (!res.ok) {
        const errText = `Failed to load output (HTTP ${res.status})`
        setState(prev => ({ ...prev, outputLoading: false, outputError: errText }))
        return null
      }
      const data = await res.json()
      setState(prev => ({
        ...prev,
        outputMd: data.output_md || null,
        outputPath: data.output_path || null,
        outputLoading: false,
        outputError: null,
      }))
      return data
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load output'
      setState(prev => ({ ...prev, outputLoading: false, outputError: errMsg }))
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const isActive = state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error' && state.phase !== 'cancelled'

  return {
    ...state,
    isActive,
    startMeeting,
    cancelMeeting,
    fetchOutput,
    reset,
  }
}
