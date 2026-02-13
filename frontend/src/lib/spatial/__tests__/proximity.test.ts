// ─── Proximity Grid Tests ───────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { ProximityGrid } from '../proximity'

describe('ProximityGrid', () => {
  it('inserts and retrieves entities', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    grid.insert({ id: 'bot-2', x: 7, z: 5, type: 'bot' })

    expect(grid.size).toBe(2)
    expect(grid.getAll()).toHaveLength(2)
  })

  it('finds entities within radius', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    grid.insert({ id: 'bot-2', x: 7, z: 5, type: 'bot' })
    grid.insert({ id: 'bot-3', x: 15, z: 15, type: 'bot' })

    const nearby = grid.queryRadius({ x: 5, z: 5, radius: 3 })
    expect(nearby).toHaveLength(2) // bot-1 and bot-2
    expect(nearby[0].id).toBe('bot-1') // closest first
    expect(nearby[0].distance).toBe(0)
    expect(nearby[1].id).toBe('bot-2')
    expect(nearby[1].distance).toBeCloseTo(2)
  })

  it('respects type filter', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    grid.insert({ id: 'desk', x: 6, z: 5, type: 'prop' })

    const bots = grid.queryRadius({ x: 5, z: 5, radius: 3, type: 'bot' })
    expect(bots).toHaveLength(1)
    expect(bots[0].id).toBe('bot-1')
  })

  it('respects excludeId', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    grid.insert({ id: 'bot-2', x: 7, z: 5, type: 'bot' })

    const nearby = grid.queryRadius({ x: 5, z: 5, radius: 5, excludeId: 'bot-1' })
    expect(nearby).toHaveLength(1)
    expect(nearby[0].id).toBe('bot-2')
  })

  it('respects limit', () => {
    const grid = new ProximityGrid(20, 20, 4)
    for (let i = 0; i < 10; i++) {
      grid.insert({ id: `bot-${i}`, x: 5 + i * 0.5, z: 5, type: 'bot' })
    }

    const nearby = grid.queryRadius({ x: 5, z: 5, radius: 10, limit: 3 })
    expect(nearby).toHaveLength(3)
  })

  it('updates entity position', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })

    // Move bot far away
    grid.update('bot-1', 18, 18)

    // Should not be near original position
    const nearOld = grid.queryRadius({ x: 5, z: 5, radius: 3 })
    expect(nearOld).toHaveLength(0)

    // Should be near new position
    const nearNew = grid.queryRadius({ x: 18, z: 18, radius: 3 })
    expect(nearNew).toHaveLength(1)
    expect(nearNew[0].id).toBe('bot-1')
  })

  it('removes entities', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    expect(grid.size).toBe(1)

    grid.remove('bot-1')
    expect(grid.size).toBe(0)

    const nearby = grid.queryRadius({ x: 5, z: 5, radius: 10 })
    expect(nearby).toHaveLength(0)
  })

  it('handles re-insertion (dedup)', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
    grid.insert({ id: 'bot-1', x: 10, z: 10, type: 'bot' })

    expect(grid.size).toBe(1)
    const nearby = grid.queryRadius({ x: 10, z: 10, radius: 1 })
    expect(nearby).toHaveLength(1)
  })

  it('findNearest returns closest match', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'desk-1', x: 3, z: 3, type: 'prop' })
    grid.insert({ id: 'desk-2', x: 15, z: 15, type: 'prop' })
    grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })

    const nearest = grid.findNearest(5, 5, 'prop')
    expect(nearest).not.toBeNull()
    expect(nearest!.id).toBe('desk-1')
  })

  it('clear removes everything', () => {
    const grid = new ProximityGrid(20, 20, 4)
    grid.insert({ id: 'a', x: 1, z: 1, type: 'bot' })
    grid.insert({ id: 'b', x: 2, z: 2, type: 'bot' })
    grid.clear()

    expect(grid.size).toBe(0)
    expect(grid.getAll()).toHaveLength(0)
  })
})
