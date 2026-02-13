/**
 * Global meeting state store for 3D bots.
 *
 * This is a lightweight reactive store (no React context) so Bot3D
 * can read meeting state in useFrame without re-renders.
 *
 * Updated from MeetingContext whenever meeting state changes.
 */

import type { MeetingPhase } from '@/hooks/useMeeting'

export interface RoomPosition {
  x: number
  z: number
  /** Door position (center of gap on -Z side) */
  doorX: number
  doorZ: number
}

export interface MeetingGatheringState {
  active: boolean
  phase: MeetingPhase
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
  /** Map of roomId → room center + door position (for pathfinding) */
  roomPositions: Map<string, RoomPosition>
  /** Map of agentId → roomId (which room each bot is in) */
  agentRooms: Map<string, string>
  /** Room size constant */
  roomSize: number
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
  roomPositions: new Map(),
  agentRooms: new Map(),
  roomSize: 12,
}

/**
 * Calculate waypoints for a bot to walk from its current position to the meeting table.
 * Path: current pos → just inside room door → outside room door → outside target room door → inside target room door → meeting pos
 */
export function calculateMeetingPath(
  _currentX: number,
  _currentZ: number,
  targetX: number,
  targetZ: number,
  botRoomId: string | undefined,
  meetingGathering: MeetingGatheringState,
): { x: number; z: number }[] {
  // If no room info available, fall back to straight line
  if (!botRoomId || meetingGathering.roomPositions.size === 0) {
    return [{ x: targetX, z: targetZ }]
  }

  const botRoom = meetingGathering.roomPositions.get(botRoomId)
  if (!botRoom) return [{ x: targetX, z: targetZ }]

  // Find which room the meeting table is in by finding the room closest to target
  let targetRoomId: string | null = null
  let targetRoom: RoomPosition | null = null
  let minDist = Infinity
  for (const [roomId, rp] of meetingGathering.roomPositions) {
    const halfSize = meetingGathering.roomSize / 2
    // Check if target is within this room's bounds (roughly)
    if (Math.abs(targetX - rp.x) < halfSize && Math.abs(targetZ - rp.z) < halfSize) {
      const d = Math.abs(targetX - rp.x) + Math.abs(targetZ - rp.z)
      if (d < minDist) {
        minDist = d
        targetRoomId = roomId
        targetRoom = rp
      }
    }
  }

  // If target is in same room as bot, go straight
  if (targetRoomId === botRoomId) {
    return [{ x: targetX, z: targetZ }]
  }

  // If we can't find the target room, go straight
  if (!targetRoom) return [{ x: targetX, z: targetZ }]

  const waypoints: { x: number; z: number }[] = []
  const doorOffset = 2.0 // How far outside the door to step

  // 1. Walk to just inside the bot's room door
  waypoints.push({ x: botRoom.doorX, z: botRoom.doorZ + 0.5 })

  // 2. Step outside the bot's room door (into hallway)
  waypoints.push({ x: botRoom.doorX, z: botRoom.doorZ - doorOffset })

  // 3. Walk through hallway to outside the target room's door
  waypoints.push({ x: targetRoom.doorX, z: targetRoom.doorZ - doorOffset })

  // 4. Step inside the target room door
  waypoints.push({ x: targetRoom.doorX, z: targetRoom.doorZ + 0.5 })

  // 5. Walk to the meeting position
  waypoints.push({ x: targetX, z: targetZ })

  return waypoints
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
  meetingGatheringState.roomPositions.clear()
  meetingGatheringState.agentRooms.clear()
}
