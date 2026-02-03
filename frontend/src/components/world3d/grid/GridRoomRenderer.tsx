// ─── Grid Room Renderer ─────────────────────────────────────────
// Renders all props in a room from its RoomBlueprint grid data.
// Replaces the hardcoded RoomProps.tsx per-room components.

import { useMemo } from 'react'
import { gridToWorld } from '@/lib/grid'
import type { RoomBlueprint } from '@/lib/grid'
import { getPropComponent } from './PropRegistry'

interface GridRoomRendererProps {
  blueprint: RoomBlueprint
  roomPosition: [number, number, number]  // world center of room (y = floor level)
}

interface PropInstance {
  key: string
  propId: string
  position: [number, number, number]
  rotation: number
  span?: { w: number; d: number }
}

/**
 * Renders all props in a room by iterating over the blueprint grid.
 * Skips spanParent cells (only renders from the anchor cell of multi-cell props).
 * Skips interaction-only and empty cells.
 */
export function GridRoomRenderer({ blueprint, roomPosition }: GridRoomRendererProps) {
  const { cells, cellSize, gridWidth, gridDepth } = blueprint

  // Build list of prop instances from grid (memoized per blueprint)
  const propInstances = useMemo(() => {
    const instances: PropInstance[] = []

    for (let z = 0; z < cells.length; z++) {
      for (let x = 0; x < cells[z].length; x++) {
        const cell = cells[z][x]

        // Skip empty cells, walls, doors, and cells without props
        if (!cell.propId) continue

        // Skip spanParent cells (rendered from their anchor)
        if (cell.spanParent) continue

        // Get the component — skip if not registered
        const Component = getPropComponent(cell.propId)
        if (!Component) continue

        // Convert grid coords to world coords (relative to room center)
        const [relX, , relZ] = gridToWorld(x, z, cellSize, gridWidth, gridDepth)

        instances.push({
          key: `${cell.propId}-${x}-${z}`,
          propId: cell.propId,
          position: [relX, 0, relZ],
          rotation: cell.rotation ?? 0,
          span: cell.span,
        })
      }
    }

    return instances
  }, [cells, cellSize, gridWidth, gridDepth])

  // Floor Y level from room position
  const floorY = roomPosition[1] + 0.16 // match the Y = 0.16 offset from RoomProps.tsx

  return (
    <group>
      {propInstances.map(({ key, propId, position, rotation, span }) => {
        const Component = getPropComponent(propId)
        if (!Component) return null

        const worldPos: [number, number, number] = [
          position[0],
          floorY,
          position[2],
        ]

        return (
          <Component
            key={key}
            position={worldPos}
            rotation={rotation}
            cellSize={cellSize}
            span={span}
          />
        )
      })}
    </group>
  )
}
