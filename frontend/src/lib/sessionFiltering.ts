import { shouldBeInParkingLane } from './minionUtils'
import type { CrewSession } from './api'
import { SESSION_CONFIG } from './sessionConfig'

// Statuses that count as "active" for display purposes.
// Sessions with other statuses (archived, pruned, etc.) are hard-filtered out
// as an extra safeguard on top of backend filtering (Issue 2 fix).
const ACTIVE_STATUSES = new Set<string | undefined>([
  // OpenClaw statuses
  'active',
  'idle',
  '',
  undefined,
  // Claude Code statuses
  'responding',
  'tool_use',
  'waiting_input',
  'waiting_permission',
])

/**
 * Split sessions into visible (in rooms) and parked (parking lane / break area).
 * Shared between 2D PlaygroundView and 3D World3DView.
 *
 * Logic:
 *  1. Hard-filter sessions with non-active status (Issue 2 fix: ghost session prevention)
 *  2. Sessions that `shouldBeInParkingLane` → parking (with full allSessions for Issue 1 fix)
 *  3. Remaining sorted by updatedAt desc, capped at maxVisible
 *  4. Overflow (beyond maxVisible) → also parking
 *  5. Parked sessions with no activity for >parkingExpiryMs are hidden entirely
 */
export function splitSessionsForDisplay(
  sessions: CrewSession[],
  isActivelyRunning: (key: string) => boolean,
  idleThreshold: number = SESSION_CONFIG.parkingIdleThresholdS,
  maxVisible: number = SESSION_CONFIG.parkingMaxVisible,
  parkingExpiryMs: number = SESSION_CONFIG.parkingExpiryMs
): { visibleSessions: CrewSession[]; parkingSessions: CrewSession[] } {
  // Issue 2 fix: hard-filter sessions with explicitly non-active status from OpenClaw.
  // This is a defensive safeguard; the backend should filter these before broadcast.
  const activeSessions = sessions.filter((s) => {
    return ACTIVE_STATUSES.has(s.status)
  })

  // Issue 1 fix: pass activeSessions as allSessions so shouldBeInParkingLane can use
  // parent session updatedAt as a proxy for sub-subagent announce routing activity.
  const visibleFilter = activeSessions.filter(
    (s) => !shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, activeSessions)
  )
  const parkingFilter = activeSessions.filter((s) =>
    shouldBeInParkingLane(s, isActivelyRunning(s.key), idleThreshold, activeSessions)
  )

  const sortedActive = [...visibleFilter].sort((a, b) => b.updatedAt - a.updatedAt)
  const visibleSessions = sortedActive.slice(0, maxVisible)
  const overflowSessions = sortedActive.slice(maxVisible)

  const now = Date.now()
  const allParking = [...overflowSessions, ...parkingFilter]
    .filter((s) => now - s.updatedAt < parkingExpiryMs)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return { visibleSessions, parkingSessions: allParking }
}
