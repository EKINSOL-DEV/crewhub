import { useMemo } from 'react'
import { getToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'

interface BuildingWallsProps {
  readonly width: number
  readonly depth: number
  readonly wallHeight?: number
  readonly entranceWidth?: number
  /** Position of entrance gap along front wall (0 = center) */
  readonly entranceOffset?: number
}

type WallSegment = {
  key: string
  position: [number, number, number]
  size: [number, number, number]
}

/**
 * Outer perimeter walls around the entire office building.
 * Includes a main entrance gap on the front (negative Z) wall.
 */
export function BuildingWalls({
  width,
  depth,
  wallHeight = 1.8,
  entranceWidth = 5,
  entranceOffset = 0,
}: BuildingWallsProps) {
  const wallToon = getToonMaterialProps(WARM_COLORS.stone)
  const accentToon = getToonMaterialProps(WARM_COLORS.stoneDark)

  const wallThickness = 0.35
  const accentHeight = 0.12
  const halfW = width / 2
  const halfD = depth / 2

  const segments = useMemo(() => {
    const segs: WallSegment[] = []

    // Back, Left, Right walls
    segs.push(
      {
        key: 'back',
        position: [0, wallHeight / 2, halfD - wallThickness / 2],
        size: [width, wallHeight, wallThickness],
      },
      {
        key: 'left',
        position: [-halfW + wallThickness / 2, wallHeight / 2, 0],
        size: [wallThickness, wallHeight, depth],
      },
      {
        key: 'right',
        position: [halfW - wallThickness / 2, wallHeight / 2, 0],
        size: [wallThickness, wallHeight, depth],
      }
    )

    // Front wall (at -Z) — two segments with entrance gap
    const entranceCenter = entranceOffset
    const gapLeft = entranceCenter - entranceWidth / 2
    const gapRight = entranceCenter + entranceWidth / 2

    // Front-left segment
    const leftSegWidth = gapLeft + halfW
    if (leftSegWidth > 0.1) {
      segs.push({
        key: 'front-left',
        position: [-halfW + leftSegWidth / 2, wallHeight / 2, -halfD + wallThickness / 2],
        size: [leftSegWidth, wallHeight, wallThickness],
      })
    }

    // Front-right segment
    const rightSegWidth = halfW - gapRight
    if (rightSegWidth > 0.1) {
      segs.push({
        key: 'front-right',
        position: [halfW - rightSegWidth / 2, wallHeight / 2, -halfD + wallThickness / 2],
        size: [rightSegWidth, wallHeight, wallThickness],
      })
    }

    return segs
  }, [width, depth, halfW, halfD, wallHeight, wallThickness, entranceWidth, entranceOffset])

  return (
    <group>
      {segments.map((seg) => (
        <group key={seg.key}>
          {/* Main wall */}
          <mesh position={seg.position} castShadow receiveShadow>
            <boxGeometry args={seg.size} />
            <meshToonMaterial {...wallToon} />
          </mesh>
          {/* Dark accent strip on top */}
          <mesh
            position={[
              seg.position[0],
              seg.position[1] + wallHeight / 2 + accentHeight / 2,
              seg.position[2],
            ]}
          >
            <boxGeometry args={[seg.size[0] + 0.02, accentHeight, seg.size[2] + 0.02]} />
            <meshToonMaterial {...accentToon} />
          </mesh>
        </group>
      ))}

      {/* Entrance pillars on either side of the gap */}
      {[entranceOffset - entranceWidth / 2, entranceOffset + entranceWidth / 2].map((x, _i) => (
        <group key={JSON.stringify(x)}>
          <mesh position={[x, wallHeight / 2, -halfD + wallThickness / 2]} castShadow>
            <boxGeometry args={[0.6, wallHeight + 0.3, 0.6]} />
            <meshToonMaterial {...accentToon} />
          </mesh>
          {/* Pillar cap */}
          <mesh position={[x, wallHeight + 0.3, -halfD + wallThickness / 2]}>
            <boxGeometry args={[0.75, 0.1, 0.75]} />
            <meshToonMaterial {...wallToon} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
