/**
 * MeetingContext — Bridges meeting state between 3D world and UI panels.
 *
 * Provides:
 * - Meeting state (via useMeeting hook)
 * - Dialog open/close
 * - Bot gathering positions
 * - Active speaker info for 3D highlights
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useMeeting, type StartMeetingParams, type MeetingState, type MeetingPhase } from '@/hooks/useMeeting'
import { updateMeetingGatheringState, resetMeetingGatheringState } from '@/lib/meetingStore'

// ─── Gathering positions ────────────────────────────────────────

export interface GatheringPosition {
  agentId: string
  x: number
  z: number
  angle: number
}

/**
 * Calculate circle positions around a center point.
 * @param centerX - Table center X
 * @param centerZ - Table center Z
 * @param participants - Agent IDs
 * @param radius - Circle radius (default 2)
 */
export function calculateGatheringPositions(
  centerX: number,
  centerZ: number,
  participants: string[],
  radius: number = 2,
): GatheringPosition[] {
  return participants.map((agentId, i) => {
    const angle = (2 * Math.PI / participants.length) * i
    return {
      agentId,
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
      angle: angle + Math.PI, // face center
    }
  })
}

// ─── Context ────────────────────────────────────────────────────

type MeetingView = 'none' | 'dialog' | 'progress' | 'output'

export interface DialogRoomContext {
  roomId?: string
  projectId?: string
  projectName?: string
}

interface MeetingContextValue {
  // State
  meeting: MeetingState & {
    isActive: boolean
    startMeeting: (params: StartMeetingParams) => Promise<unknown>
    cancelMeeting: () => Promise<unknown>
    fetchOutput: () => Promise<unknown>
    reset: () => void
  }
  view: MeetingView
  gatheringPositions: GatheringPosition[]
  dialogRoomContext: DialogRoomContext | null

  // Actions
  openDialog: () => void
  openDialogForRoom: (ctx: DialogRoomContext) => void
  closeDialog: () => void
  showProgress: () => void
  showOutput: () => void
  closeView: () => void
  setTablePosition: (x: number, z: number) => void
}

const MeetingContext = createContext<MeetingContextValue | null>(null)

export function MeetingProvider({ children }: { children: ReactNode }) {
  const meeting = useMeeting()
  const [view, setView] = useState<MeetingView>('none')
  const [tablePos, setTablePos] = useState<{ x: number; z: number }>({ x: 0, z: 0 })
  const [dialogRoomContext, setDialogRoomContext] = useState<DialogRoomContext | null>(null)

  const gatheringPositions = useMemo(() => {
    if (!meeting.isActive && meeting.phase !== 'complete') return []
    return calculateGatheringPositions(tablePos.x, tablePos.z, meeting.participants)
  }, [meeting.isActive, meeting.phase, meeting.participants, tablePos.x, tablePos.z])

  // Auto-switch views based on phase changes (in useEffect, not render)
  const prevPhaseRef = useRef<MeetingPhase>('idle')
  useEffect(() => {
    const prev = prevPhaseRef.current
    const next = meeting.phase
    if (prev === next) return
    prevPhaseRef.current = next

    if (prev === 'idle' && (next === 'gathering' || next === 'round')) {
      setView('progress')
    }
    if (next === 'complete' && view === 'progress') {
      meeting.fetchOutput()
      setView('output')
    }
    // cancelled/error: keep progress view to show the state
  }, [meeting.phase, view, meeting])

  const openDialog = useCallback(() => {
    setDialogRoomContext(null)
    setView('dialog')
  }, [])
  const openDialogForRoom = useCallback((ctx: DialogRoomContext) => {
    setDialogRoomContext(ctx)
    setView('dialog')
  }, [])
  const closeDialog = useCallback(() => setView('none'), [])
  const showProgress = useCallback(() => setView('progress'), [])
  const showOutput = useCallback(() => {
    meeting.fetchOutput()
    setView('output')
  }, [meeting])
  const closeView = useCallback(() => {
    setView('none')
    if (meeting.phase === 'complete' || meeting.phase === 'error' || meeting.phase === 'cancelled') {
      meeting.reset()
    }
  }, [meeting])
  const setTablePosition = useCallback((x: number, z: number) => setTablePos({ x, z }), [])

  // Sync meeting state to the global store for Bot3D useFrame reads
  useEffect(() => {
    if (!meeting.isActive && meeting.phase !== 'complete') {
      resetMeetingGatheringState()
      return
    }

    const posMap = new Map<string, { x: number; z: number; angle: number }>()
    for (const gp of gatheringPositions) {
      posMap.set(gp.agentId, { x: gp.x, z: gp.z, angle: gp.angle })
    }

    // Find latest response text from active speaker
    let speakerText: string | null = null
    if (meeting.currentTurnAgentId) {
      for (const round of meeting.rounds) {
        const turn = round.turns.find(
          t => t.agentId === meeting.currentTurnAgentId && t.status === 'done'
        )
        if (turn?.response) speakerText = turn.response
      }
    }

    // Completed turns in current round
    const completed = new Set<string>()
    const currentRound = meeting.rounds[meeting.currentRound - 1]
    if (currentRound) {
      for (const turn of currentRound.turns) {
        if (turn.status === 'done') completed.add(turn.agentId)
      }
    }

    updateMeetingGatheringState({
      active: meeting.isActive,
      phase: meeting.phase,
      positions: posMap,
      activeSpeaker: meeting.currentTurnAgentId,
      activeSpeakerText: speakerText,
      completedTurns: completed,
      synthesizing: meeting.phase === 'synthesizing',
      complete: meeting.phase === 'complete',
    })
  }, [meeting, gatheringPositions])

  const value: MeetingContextValue = {
    meeting,
    view,
    gatheringPositions,
    openDialog,
    openDialogForRoom,
    dialogRoomContext,
    closeDialog,
    showProgress,
    showOutput,
    closeView,
    setTablePosition,
  }

  return (
    <MeetingContext.Provider value={value}>
      {children}
    </MeetingContext.Provider>
  )
}

export function useMeetingContext() {
  const ctx = useContext(MeetingContext)
  if (!ctx) throw new Error('useMeetingContext must be used within MeetingProvider')
  return ctx
}
