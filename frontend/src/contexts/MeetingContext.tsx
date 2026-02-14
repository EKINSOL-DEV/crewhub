/**
 * MeetingContext — Bridges meeting state between 3D world and UI panels.
 *
 * Provides:
 * - Meeting state (via useMeeting hook)
 * - Dialog open/close
 * - Bot gathering positions
 * - Active speaker info for 3D highlights
 * - Sidebar panel state (F2)
 * - Follow-up meeting support (F4)
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useMeeting, type StartMeetingParams, type MeetingState, type MeetingPhase } from '@/hooks/useMeeting'
import { useDemoMeeting } from '@/hooks/useDemoMeeting'
import { updateMeetingGatheringState, resetMeetingGatheringState } from '@/lib/meetingStore'
import { showToast } from '@/lib/toast'
import type { FollowUpContext } from '@/components/meetings/MeetingDialog'

const isPublicDemo = import.meta.env.VITE_DEMO_MODE === 'true'

// ─── Gathering positions ────────────────────────────────────────

export interface GatheringPosition {
  agentId: string
  x: number
  z: number
  angle: number
}

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
      angle: angle + Math.PI,
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

  // F2: Sidebar
  sidebarMeetingId: string | null
  openInSidebar: (meetingId: string) => void
  closeSidebar: () => void

  // F4: Follow-up
  followUpContext: FollowUpContext | null
  openFollowUp: (meetingId: string) => void

  // Actions
  openDialog: () => void
  openDialogForRoom: (ctx: DialogRoomContext) => void
  closeDialog: () => void
  showProgress: () => void
  showOutput: () => void
  closeView: () => void
  setTablePosition: (x: number, z: number) => void

  // Demo meeting
  startDemoMeeting: () => void
  isDemoMeetingActive: boolean
}

const MeetingContext = createContext<MeetingContextValue | null>(null)

export function MeetingProvider({ children }: { children: ReactNode }) {
  const realMeeting = useMeeting()
  const { demoMeeting, startDemoMeeting, isDemoMeetingActive, isDemoMeetingComplete } = useDemoMeeting()

  // In demo mode with active demo meeting, use demo state; otherwise use real meeting
  const meeting = (isPublicDemo && (isDemoMeetingActive || isDemoMeetingComplete)) ? demoMeeting : realMeeting

  const [view, setView] = useState<MeetingView>('none')
  const [tablePos, setTablePos] = useState<{ x: number; z: number }>({ x: 0, z: 0 })
  const [dialogRoomContext, setDialogRoomContext] = useState<DialogRoomContext | null>(null)
  const [sidebarMeetingId, setSidebarMeetingId] = useState<string | null>(null)
  const [followUpContext, setFollowUpContext] = useState<FollowUpContext | null>(null)

  const gatheringPositions = useMemo(() => {
    if (!meeting.isActive && meeting.phase !== 'complete') return []
    return calculateGatheringPositions(tablePos.x, tablePos.z, meeting.participants)
  }, [meeting.isActive, meeting.phase, meeting.participants, tablePos.x, tablePos.z])

  // Auto-switch views based on phase changes
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
      // F6: Open results in fullscreen overlay
      if (meeting.meetingId) {
        setSidebarMeetingId(meeting.meetingId)
      }
      setView('none')
      showToast({ message: '✅ Meeting complete!' })
    }
  }, [meeting.phase, view, meeting])

  const openDialog = useCallback(() => {
    setDialogRoomContext(null)
    setFollowUpContext(null)
    setView('dialog')
  }, [])
  const openDialogForRoom = useCallback((ctx: DialogRoomContext) => {
    setDialogRoomContext(ctx)
    setFollowUpContext(null)
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

  // F2: Sidebar
  const openInSidebar = useCallback((meetingId: string) => {
    setSidebarMeetingId(meetingId)
    // Close the dialog/output view if open
    if (view === 'output') {
      setView('none')
      meeting.reset()
    }
  }, [view, meeting])
  const closeSidebar = useCallback(() => setSidebarMeetingId(null), [])

  // F4: Follow-up
  const openFollowUp = useCallback(async (meetingId: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/status`)
      const data = await res.json()
      setFollowUpContext({
        parentMeetingId: meetingId,
        title: data.title || '',
        goal: data.goal || data.title || '',
        participants: data.participants?.map((p: any) => p.agent_id) || [],
        roomId: data.room_id,
        projectId: data.project_id,
      })
      setDialogRoomContext({
        roomId: data.room_id,
        projectId: data.project_id,
      })
      setView('dialog')
    } catch {
      setFollowUpContext(null)
      setView('dialog')
    }
  }, [])

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

    let speakerText: string | null = null
    if (meeting.currentTurnAgentId) {
      for (const round of meeting.rounds) {
        const turn = round.turns.find(
          t => t.agentId === meeting.currentTurnAgentId && t.status === 'done'
        )
        if (turn?.response) speakerText = turn.response
      }
    }

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

  const handleStartDemoMeeting = useCallback(() => {
    startDemoMeeting()
    setView('progress')
  }, [startDemoMeeting])

  const value = useMemo<MeetingContextValue>(() => ({
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
    sidebarMeetingId,
    openInSidebar,
    closeSidebar,
    followUpContext,
    openFollowUp,
    startDemoMeeting: handleStartDemoMeeting,
    isDemoMeetingActive,
  }), [meeting, view, gatheringPositions, openDialog, openDialogForRoom, dialogRoomContext, closeDialog, showProgress, showOutput, closeView, setTablePosition, sidebarMeetingId, openInSidebar, closeSidebar, followUpContext, openFollowUp, handleStartDemoMeeting, isDemoMeetingActive])

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
