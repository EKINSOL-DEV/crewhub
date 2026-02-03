import { useMemo } from 'react'
import { useToonMaterialProps } from './utils/toonMaterials'

interface HallwayFloorLinesProps {
  roomSize: number
  hallwayWidth: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

/**
 * Subtle dashed center lines along hallways for a polished office look.
 * Thin floor-level markings that hint at walkable corridors.
 */
export function HallwayFloorLines({
  roomSize,
  hallwayWidth,
  cols,
  rows,
  gridOriginX,
  gridOriginZ,
}: HallwayFloorLinesProps) {
  const lineToon = useToonMaterialProps('#C4B498')
  const gridSpacing = roomSize + hallwayWidth
  const halfRoom = roomSize / 2

  // Compute strict grid bounds — lines must stay within the room grid area
  const gridMaxX = gridOriginX + (cols - 1) * gridSpacing + halfRoom
  const gridMaxZ = gridOriginZ + (rows - 1) * gridSpacing + halfRoom

  const lines = useMemo(() => {
    const items: { position: [number, number, number]; size: [number, number] }[] = []
    const dashLength = 1.0
    const gapLength = 0.6

    // Horizontal hallway center lines (between rows, spanning across columns + gaps)
    for (let row = 0; row < rows - 1; row++) {
      const z = gridOriginZ + row * gridSpacing + halfRoom + hallwayWidth / 2

      // Span from first room left edge to last room right edge (entire grid width)
      const startX = gridOriginX - halfRoom
      const endX = gridMaxX
      const totalLength = endX - startX
      const numDashes = Math.floor(totalLength / (dashLength + gapLength))

      for (let d = 0; d < numDashes; d++) {
        const x = startX + d * (dashLength + gapLength) + dashLength / 2
        // Strictly bound within grid
        if (x + dashLength / 2 > gridMaxX + 0.1) break
        items.push({
          position: [x, 0.085, z],
          size: [dashLength, 0.12],
        })
      }
    }

    // Vertical hallway center lines (between columns, spanning across rows + gaps)
    for (let col = 0; col < cols - 1; col++) {
      const x = gridOriginX + col * gridSpacing + halfRoom + hallwayWidth / 2

      const startZ = gridOriginZ - halfRoom
      const endZ = gridMaxZ
      const totalLength = endZ - startZ
      const numDashes = Math.floor(totalLength / (dashLength + gapLength))

      for (let d = 0; d < numDashes; d++) {
        const z = startZ + d * (dashLength + gapLength) + dashLength / 2
        if (z + dashLength / 2 > gridMaxZ + 0.1) break
        items.push({
          position: [x, 0.085, z],
          size: [0.12, dashLength],
        })
      }
    }

    return items
  }, [roomSize, hallwayWidth, cols, rows, gridOriginX, gridOriginZ, gridSpacing, halfRoom, gridMaxX, gridMaxZ])

  return (
    <group>
      {lines.map((line, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={line.position}>
          <planeGeometry args={line.size} />
          <meshToonMaterial {...lineToon} />
        </mesh>
      ))}
    </group>
  )
}
