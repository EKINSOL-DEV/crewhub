import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ZoneRuntimeState } from '../lib/zones/types'

const STORAGE_KEY = 'crewhub-zone-state-v1'

// Inline the class to avoid singleton side-effects
class ZonePersistence {
  save(state: ZoneRuntimeState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  load(): ZoneRuntimeState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed.version !== 1) {
        this.clear()
        return null
      }
      return parsed
    } catch {
      this.clear()
      return null
    }
  }
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
  savePosition(zoneId: string, position: [number, number, number]): void {
    const state = this.load() ?? { version: 1, activeZoneId: zoneId, perZoneState: {} }
    if (!state.perZoneState[zoneId])
      state.perZoneState[zoneId] = { lastPosition: null, lastVisitTimestamp: 0 }
    state.perZoneState[zoneId].lastPosition = position
    state.perZoneState[zoneId].lastVisitTimestamp = Date.now()
    this.save(state)
  }
  saveActiveZone(zoneId: string): void {
    const state = this.load() ?? { version: 1, activeZoneId: zoneId, perZoneState: {} }
    state.activeZoneId = zoneId
    this.save(state)
  }
  getPosition(zoneId: string): [number, number, number] | null {
    return this.load()?.perZoneState[zoneId]?.lastPosition ?? null
  }
  getActiveZoneId(): string | null {
    return this.load()?.activeZoneId ?? null
  }
}

describe('ZonePersistence', () => {
  let persistence: ZonePersistence

  beforeEach(() => {
    localStorage.clear()
    persistence = new ZonePersistence()
  })

  it('returns null when nothing stored', () => {
    expect(persistence.load()).toBeNull()
    expect(persistence.getActiveZoneId()).toBeNull()
    expect(persistence.getPosition('x')).toBeNull()
  })

  it('saves and loads state', () => {
    const state: ZoneRuntimeState = {
      version: 1,
      activeZoneId: 'main-campus',
      perZoneState: {},
    }
    persistence.save(state)
    expect(persistence.load()).toEqual(state)
  })

  it('rejects version mismatch', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 999, activeZoneId: 'x', perZoneState: {} })
    )
    expect(persistence.load()).toBeNull()
    // Should also have cleared
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json')
    expect(persistence.load()).toBeNull()
  })

  it('saves and retrieves position', () => {
    persistence.savePosition('main-campus', [1, 2, 3])
    expect(persistence.getPosition('main-campus')).toEqual([1, 2, 3])
  })

  it('saves and retrieves active zone', () => {
    persistence.saveActiveZone('creator-center')
    expect(persistence.getActiveZoneId()).toBe('creator-center')
  })

  it('clear removes data', () => {
    persistence.saveActiveZone('main-campus')
    persistence.clear()
    expect(persistence.load()).toBeNull()
  })
})
