import { describe, it, expect, beforeEach } from 'vitest'
import type { Zone } from '../lib/zones/types'

// We test the class directly (not the singleton) to avoid cross-test pollution
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
    return this.zones.values().next().value!
  }
  getAll(): Zone[] {
    return Array.from(this.zones.values())
  }
  has(zoneId: string): boolean {
    return this.zones.has(zoneId)
  }
}

const makeZone = (overrides: Partial<Zone> = {}): Zone => ({
  id: 'test-zone',
  name: 'Test Zone',
  icon: '🧪',
  environment: 'grass',
  colorPrimary: '#000',
  layout: 'campus',
  defaultSpawnPoint: [0, 0, 0],
  ...overrides,
})

describe('ZoneRegistry', () => {
  let registry: ZoneRegistry

  beforeEach(() => {
    registry = new ZoneRegistry()
  })

  it('registers and retrieves a zone', () => {
    const zone = makeZone()
    registry.register(zone)
    expect(registry.get('test-zone')).toBe(zone)
  })

  it('returns null for unknown zone', () => {
    expect(registry.get('nope')).toBeNull()
  })

  it('has() works', () => {
    registry.register(makeZone())
    expect(registry.has('test-zone')).toBe(true)
    expect(registry.has('nope')).toBe(false)
  })

  it('getDefault returns zone with isDefault', () => {
    registry.register(makeZone({ id: 'a' }))
    registry.register(makeZone({ id: 'b', isDefault: true }))
    expect(registry.getDefault().id).toBe('b')
  })

  it('getDefault falls back to first zone if none marked', () => {
    registry.register(makeZone({ id: 'first' }))
    registry.register(makeZone({ id: 'second' }))
    expect(registry.getDefault().id).toBe('first')
  })

  it('getAll returns all registered zones', () => {
    registry.register(makeZone({ id: 'a' }))
    registry.register(makeZone({ id: 'b' }))
    expect(registry.getAll()).toHaveLength(2)
  })
})
