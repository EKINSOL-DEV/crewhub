import { describe, it, expect } from 'vitest'
import {
  getRoomSize,
  getRoomBounds,
  getParkingBounds,
  calculateBuildingLayout,
  ROOM_SIZE,
  HQ_SIZE,
} from '@/components/world3d/utils/buildingLayout'

function room(id: string, sort: number, is_hq = false) {
  return {
    id,
    name: id,
    icon: '📦',
    color: '#111111',
    sort_order: sort,
    floor_style: 'default',
    wall_style: 'default',
    project_id: null,
    project_name: null,
    project_color: null,
    is_hq,
    created_at: 1,
    updated_at: 1,
  }
}

describe('buildingLayout utilities', () => {
  it('returns HQ size for HQ room and normal size otherwise', () => {
    expect(getRoomSize({ is_hq: true })).toBe(HQ_SIZE)
    expect(getRoomSize({ is_hq: false })).toBe(ROOM_SIZE)
  })

  it('computes room and parking bounds with margins', () => {
    expect(getRoomBounds([10, 0, -2], 12)).toEqual({ minX: 6.5, maxX: 13.5, minZ: -5.5, maxZ: 1.5 })
    expect(getParkingBounds(0, 0, 10, 12)).toEqual({ minX: -3, maxX: 3, minZ: -4, maxZ: 4 })
  })

  it('builds single-room HQ layout', () => {
    const layout = calculateBuildingLayout([room('hq', 1, true)])
    expect(layout.cols).toBe(1)
    expect(layout.rows).toBe(1)
    expect(layout.roomPositions).toHaveLength(1)
    expect(layout.roomPositions[0].size).toBe(HQ_SIZE)
    expect(layout.parkingArea.width).toBeGreaterThan(0)
  })

  it('caps peripheral rooms at 3x3 ring for >9 rooms', () => {
    const rooms = [
      room('hq', 0, true),
      ...Array.from({ length: 10 }, (_, i) => room(`r${i}`, i + 1)),
    ]
    const layout = calculateBuildingLayout(rooms)
    expect(layout.cols).toBe(3)
    expect(layout.rows).toBe(3)
    expect(layout.roomPositions).toHaveLength(9)
  })
})
