import { shouldBeInParkingLane } from './minionUtils'
import type { CrewSession } from './api'
import { SESSION_CONFIG } from './sessionConfig'

/**
 * Split sessions into visible (in rooms) and parked (parking lane / break area).
 * Shared between 2D PlaygroundView and 3D World3DView.
 *
 * Logic:
 *  1. Sessions that `shouldBeInParkingLane` → parking
 *  2. Remaining sorted by updatedAt desc, capped at maxVisible
 *  3. Overflow (beyond maxVisible) → also parking
 *  4. Parked sessions with no activity for >parkingExpiryMs are hidden entirely
 */
export function splitSessionsForDisplay(
  sessions: CrewSession[],
  isActivelyRunning: (key: string) => boolean,
  idleThreshold: number = SESSION_CONFIG.parkingIdleThresholdS,
  maxVisible: number = SESSION_CONFIG.parkingMaxVisible,
  parkingExpiryMs: number = SESSION_CONFIG.parkingExpiryMs,
): { visibleSessions: CrewSession[]; parkingSessions: CrewSession[] } {
  const activeSessions = sessions.filter(
    s => !shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold),
  )
  const parkingSessions = sessions.filter(
    s => shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold),
  )

  const sortedActive = [...activeSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const visibleSessions = sortedActive.slice(0, maxVisible)
  const overflowSessions = sortedActive.slice(maxVisible)

  const now = Date.now()
  const allParking = [...overflowSessions, ...parkingSessions]
    .filter(s => (now - s.updatedAt) < parkingExpiryMs)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return { visibleSessions, parkingSessions: allParking }
}
