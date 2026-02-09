import type { ZoneRuntimeState } from './types'

const STORAGE_KEY = 'crewhub-zone-state-v1'
const CURRENT_VERSION = 1

class ZonePersistence {
  save(state: ZoneRuntimeState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.error('[ZonePersistence] Failed to save:', err)
    }
  }

  load(): ZoneRuntimeState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed.version !== CURRENT_VERSION) {
        console.warn('[ZonePersistence] Version mismatch, resetting')
        this.clear()
        return null
      }
      return parsed as ZoneRuntimeState
    } catch (err) {
      console.error('[ZonePersistence] Failed to load:', err)
      this.clear()
      return null
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  savePosition(zoneId: string, position: [number, number, number]): void {
    const state = this.load() ?? this.defaultState(zoneId)
    if (!state.perZoneState[zoneId]) {
      state.perZoneState[zoneId] = { lastPosition: null, lastVisitTimestamp: 0 }
    }
    state.perZoneState[zoneId].lastPosition = position
    state.perZoneState[zoneId].lastVisitTimestamp = Date.now()
    this.save(state)
  }

  saveActiveZone(zoneId: string): void {
    const state = this.load() ?? this.defaultState(zoneId)
    state.activeZoneId = zoneId
    if (!state.perZoneState[zoneId]) {
      state.perZoneState[zoneId] = { lastPosition: null, lastVisitTimestamp: 0 }
    }
    state.perZoneState[zoneId].lastVisitTimestamp = Date.now()
    this.save(state)
  }

  getPosition(zoneId: string): [number, number, number] | null {
    const state = this.load()
    return state?.perZoneState[zoneId]?.lastPosition ?? null
  }

  getActiveZoneId(): string | null {
    return this.load()?.activeZoneId ?? null
  }

  private defaultState(activeZoneId: string): ZoneRuntimeState {
    return { version: CURRENT_VERSION, activeZoneId, perZoneState: {} }
  }
}

export const zonePersistence = new ZonePersistence()
