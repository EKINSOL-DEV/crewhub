import { useMemo } from 'react'
import { useToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'

interface RoomWallsProps {
  color?: string   // accent color strip
  size?: number    // room size in units (default 12)
  wallHeight?: number // default 1.5
}

type WallSegment = {
  key: string
  position: [number, number, number]
  size: [number, number, number]
  isAccent?: boolean
}

/**
 * Low walls around the room perimeter with:
 * - Gap/opening on one side (front, facing camera from isometric view)
 * - Color accent strip at top matching room color
 * - Rounded cap cylinders on top
 */
export function RoomWalls({ color, size = 12, wallHeight = 1.5 }: RoomWallsProps) {
  const accentColor = color || '#4f46e5'
  const wallColor = WARM_COLORS.stone
  const wallToon = useToonMaterialProps(wallColor)
  const accentToon = useToonMaterialProps(accentColor)

  const wallThickness = 0.3
  const accentHeight = 0.15
  const halfSize = size / 2
  const gapWidth = 3 // opening width for "door"

  // Pre-compute wall segment data
  // Floor top surface offset — walls sit on top of the room floor overlay
  const floorTop = 0.16

  const { segments, caps } = useMemo(() => {
    const segs: WallSegment[] = []
    const capPositions: Array<{ key: string; position: [number, number, number] }> = []

    // Back wall (full width, at +Z)
    segs.push({
      key: 'back-wall',
      position: [0, floorTop + wallHeight / 2, halfSize - wallThickness / 2],
      size: [size, wallHeight, wallThickness],
    })
    segs.push({
      key: 'back-accent',
      position: [0, floorTop + wallHeight + accentHeight / 2, halfSize - wallThickness / 2],
      size: [size, accentHeight, wallThickness + 0.02],
      isAccent: true,
    })

    // Left wall (full depth, at -X)
    segs.push({
      key: 'left-wall',
      position: [-halfSize + wallThickness / 2, floorTop + wallHeight / 2, 0],
      size: [wallThickness, wallHeight, size],
    })
    segs.push({
      key: 'left-accent',
      position: [-halfSize + wallThickness / 2, floorTop + wallHeight + accentHeight / 2, 0],
      size: [wallThickness + 0.02, accentHeight, size],
      isAccent: true,
    })

    // Right wall (full depth, at +X)
    segs.push({
      key: 'right-wall',
      position: [halfSize - wallThickness / 2, floorTop + wallHeight / 2, 0],
      size: [wallThickness, wallHeight, size],
    })
    segs.push({
      key: 'right-accent',
      position: [halfSize - wallThickness / 2, floorTop + wallHeight + accentHeight / 2, 0],
      size: [wallThickness + 0.02, accentHeight, size],
      isAccent: true,
    })

    // Front wall (at -Z) — TWO segments with a gap in the middle
    const sideWidth = (size - gapWidth) / 2
    // Front-left segment
    segs.push({
      key: 'front-left-wall',
      position: [-halfSize + sideWidth / 2, floorTop + wallHeight / 2, -halfSize + wallThickness / 2],
      size: [sideWidth, wallHeight, wallThickness],
    })
    segs.push({
      key: 'front-left-accent',
      position: [-halfSize + sideWidth / 2, floorTop + wallHeight + accentHeight / 2, -halfSize + wallThickness / 2],
      size: [sideWidth, accentHeight, wallThickness + 0.02],
      isAccent: true,
    })
    // Front-right segment
    segs.push({
      key: 'front-right-wall',
      position: [halfSize - sideWidth / 2, floorTop + wallHeight / 2, -halfSize + wallThickness / 2],
      size: [sideWidth, wallHeight, wallThickness],
    })
    segs.push({
      key: 'front-right-accent',
      position: [halfSize - sideWidth / 2, floorTop + wallHeight + accentHeight / 2, -halfSize + wallThickness / 2],
      size: [sideWidth, accentHeight, wallThickness + 0.02],
      isAccent: true,
    })

    // Rounded cap cylinders along wall tops (corners + ends of gap)
    const capY = floorTop + wallHeight + accentHeight
    const capRadius = wallThickness / 2 + 0.02
    const corners: [number, number, number][] = [
      [-halfSize, capY, -halfSize],
      [-halfSize, capY, halfSize],
      [halfSize, capY, -halfSize],
      [halfSize, capY, halfSize],
      // Gap edges
      [-gapWidth / 2, capY, -halfSize],
      [gapWidth / 2, capY, -halfSize],
    ]
    corners.forEach((pos, i) => {
      capPositions.push({ key: `cap-${i}`, position: pos })
    })

    return { segments: segs, caps: capPositions, capRadius }
  }, [halfSize, size, wallHeight, accentHeight, gapWidth, floorTop])

  const capRadius = wallThickness / 2 + 0.02

  return (
    <group>
      {/* Wall segments */}
      {segments.map((seg) => (
        <mesh
          key={seg.key}
          position={seg.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={seg.size} />
          <meshToonMaterial {...(seg.isAccent ? accentToon : wallToon)} />
        </mesh>
      ))}

      {/* Rounded caps on top of walls at corners and gap edges */}
      {caps.map((cap) => (
        <mesh
          key={cap.key}
          position={cap.position}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <sphereGeometry args={[capRadius, 12, 12]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
      ))}
    </group>
  )
}
