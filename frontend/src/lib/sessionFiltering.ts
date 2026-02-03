import { shouldBeInParkingLane } from './minionUtils'
import type { CrewSession } from './api'

/**
 * Split sessions into visible (in rooms) and parked (parking lane / break area).
 * Shared between 2D PlaygroundView and 3D World3DView.
 *
 * Logic:
 *  1. Sessions that `shouldBeInParkingLane` → parking
 *  2. Remaining sorted by updatedAt desc, capped at maxVisible
 *  3. Overflow (beyond maxVisible) → also parking
 */
export function splitSessionsForDisplay(
  sessions: CrewSession[],
  isActivelyRunning: (key: string) => boolean,
  idleThreshold: number = 120,
  maxVisible: number = 15,
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

  const allParking = [...overflowSessions, ...parkingSessions].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )

  return { visibleSessions, parkingSessions: allParking }
}
