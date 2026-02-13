/**
 * Global meeting state store for 3D bots.
 *
 * This is a lightweight reactive store (no React context) so Bot3D
 * can read meeting state in useFrame without re-renders.
 *
 * Updated from MeetingContext whenever meeting state changes.
 */

export interface MeetingGatheringState {
  active: boolean
  phase: string
  /** Map of agentId → target position for gathering */
  positions: Map<string, { x: number; z: number; angle: number }>
  /** Currently speaking agent ID */
  activeSpeaker: string | null
  /** Last response text from active speaker (for speech bubble) */
  activeSpeakerText: string | null
  /** Set of agents that completed their turn in current round */
  completedTurns: Set<string>
  /** Is in synthesis phase (all bots face center) */
  synthesizing: boolean
  /** Is complete */
  complete: boolean
}

/** Global mutable state — read in useFrame, written from React */
export const meetingGatheringState: MeetingGatheringState = {
  active: false,
  phase: 'idle',
  positions: new Map(),
  activeSpeaker: null,
  activeSpeakerText: null,
  completedTurns: new Set(),
  synthesizing: false,
  complete: false,
}

/**
 * Update the gathering state from MeetingContext.
 * Called in a useEffect in MeetingProvider.
 */
export function updateMeetingGatheringState(update: Partial<MeetingGatheringState>) {
  Object.assign(meetingGatheringState, update)
}

/** Reset to idle */
export function resetMeetingGatheringState() {
  meetingGatheringState.active = false
  meetingGatheringState.phase = 'idle'
  meetingGatheringState.positions.clear()
  meetingGatheringState.activeSpeaker = null
  meetingGatheringState.activeSpeakerText = null
  meetingGatheringState.completedTurns.clear()
  meetingGatheringState.synthesizing = false
  meetingGatheringState.complete = false
}
