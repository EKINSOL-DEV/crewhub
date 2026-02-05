import { describe, it, expect, vi } from 'vitest'
import { splitSessionsForDisplay } from '../lib/sessionFiltering'
import type { CrewSession } from '../lib/api'

const makeMockSession = (key: string, updatedAt: number): CrewSession => ({
  key,
  kind: 'agent',
  channel: 'cli',
  updatedAt,
  sessionId: `sess-${key}`,
})

describe('splitSessionsForDisplay', () => {
  it('splits sessions into visible and parking', () => {
    const now = Date.now()
    const sessions = [
      makeMockSession('agent:main:main', now),
      makeMockSession('agent:main:subagent:1', now),
      // 5 minutes ago - idle but not expired from parking (within 30min parkingExpiryMs)
      makeMockSession('agent:main:subagent:2', now - 5 * 60 * 1000),
    ]

    const isActive = (key: string) => key === 'agent:main:main'
    const { visibleSessions, parkingSessions } = splitSessionsForDisplay(
      sessions,
      isActive,
      120,  // idle threshold 2 min
      15,   // maxVisible
      30 * 60 * 1000, // parkingExpiryMs 30 min
    )

    // Main agent never parks
    expect(visibleSessions.some(s => s.key === 'agent:main:main')).toBe(true)
    // Recent subagent stays visible
    expect(visibleSessions.some(s => s.key === 'agent:main:subagent:1')).toBe(true)
    // Idle subagent (>2min idle) goes to parking
    expect(parkingSessions.some(s => s.key === 'agent:main:subagent:2')).toBe(true)
  })

  it('respects maxVisible limit', () => {
    const now = Date.now()
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeMockSession(`agent:main:subagent:${i}`, now - i * 1000)
    )

    const { visibleSessions, parkingSessions } = splitSessionsForDisplay(
      sessions,
      () => true,
      600, // idle threshold
      10,  // maxVisible
    )

    expect(visibleSessions.length).toBeLessThanOrEqual(10)
  })

  it('returns empty arrays for empty input', () => {
    const { visibleSessions, parkingSessions } = splitSessionsForDisplay(
      [],
      () => false,
    )
    expect(visibleSessions).toEqual([])
    expect(parkingSessions).toEqual([])
  })

  it('expires very old sessions from parking', () => {
    const longAgo = Date.now() - 365 * 24 * 60 * 60 * 1000 // 1 year ago
    const sessions = [
      makeMockSession('agent:main:subagent:ancient', longAgo),
    ]

    const { parkingSessions } = splitSessionsForDisplay(
      sessions,
      () => false,
      600,
      100,
      24 * 60 * 60 * 1000, // 24h parking expiry
    )

    // Ancient session should be expired from parking
    expect(parkingSessions.length).toBe(0)
  })

  it('sorts visible sessions by recency', () => {
    const now = Date.now()
    const sessions = [
      makeMockSession('agent:main:subagent:old', now - 5000),
      makeMockSession('agent:main:subagent:new', now - 1000),
      makeMockSession('agent:main:subagent:newest', now),
    ]

    const { visibleSessions } = splitSessionsForDisplay(
      sessions,
      () => true,
    )

    // Should be sorted newest first
    expect(visibleSessions[0].key).toBe('agent:main:subagent:newest')
    expect(visibleSessions[visibleSessions.length - 1].key).toBe('agent:main:subagent:old')
  })
})
