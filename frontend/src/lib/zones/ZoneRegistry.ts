import type { Zone } from './types'
import { BUILTIN_ZONES } from './builtinZones'

class ZoneRegistry {
  private readonly zones = new Map<string, Zone>()

  register(zone: Zone): void {
    this.zones.set(zone.id, zone)
  }

  get(zoneId: string): Zone | null {
    return this.zones.get(zoneId) ?? null
  }

  getDefault(): Zone {
    for (const z of this.zones.values()) {
      if (z.isDefault) return z
    }
    // Fallback: first registered zone
    return this.zones.values().next().value!
  }

  getAll(): Zone[] {
    return Array.from(this.zones.values())
  }

  has(zoneId: string): boolean {
    return this.zones.has(zoneId)
  }
}

export const zoneRegistry = new ZoneRegistry()

// Auto-register built-in zones
for (const z of BUILTIN_ZONES) {
  zoneRegistry.register(z)
}
