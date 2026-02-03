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

  const lines = useMemo(() => {
    const items: { position: [number, number, number]; size: [number, number] }[] = []

    // Horizontal hallway lines (between rows)
    for (let row = 0; row < rows - 1; row++) {
      const z = gridOriginZ + row * gridSpacing + halfRoom + hallwayWidth / 2

      // Dashed lines across the hallway
      for (let col = 0; col < cols; col++) {
        const startX = gridOriginX + col * gridSpacing - halfRoom
        const endX = gridOriginX + col * gridSpacing + halfRoom

        // Create dashes
        const dashLength = 1.0
        const gapLength = 0.6
        const totalLength = endX - startX
        const numDashes = Math.floor(totalLength / (dashLength + gapLength))

        for (let d = 0; d < numDashes; d++) {
          const x = startX + d * (dashLength + gapLength) + dashLength / 2
          items.push({
            position: [x, 0.085, z],
            size: [dashLength, 0.12],
          })
        }
      }
    }

    // Vertical hallway lines (between columns)
    for (let col = 0; col < cols - 1; col++) {
      const x = gridOriginX + col * gridSpacing + halfRoom + hallwayWidth / 2

      for (let row = 0; row < rows; row++) {
        const startZ = gridOriginZ + row * gridSpacing - halfRoom
        const endZ = gridOriginZ + row * gridSpacing + halfRoom

        const dashLength = 1.0
        const gapLength = 0.6
        const totalLength = endZ - startZ
        const numDashes = Math.floor(totalLength / (dashLength + gapLength))

        for (let d = 0; d < numDashes; d++) {
          const z = startZ + d * (dashLength + gapLength) + dashLength / 2
          items.push({
            position: [x, 0.085, z],
            size: [0.12, dashLength],
          })
        }
      }
    }

    return items
  }, [roomSize, hallwayWidth, cols, rows, gridOriginX, gridOriginZ, gridSpacing, halfRoom])

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
