import { useToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
}

/**
 * Solid room floor — single box with toon shading.
 * Much simpler and more performant than the old per-tile grid.
 */
export function RoomFloor({ color, size = 12 }: RoomFloorProps) {
  const baseColor = color || WARM_COLORS.stone
  const toonProps = useToonMaterialProps(baseColor)
  const baseToonProps = useToonMaterialProps(WARM_COLORS.stoneDark)

  return (
    <group>
      {/* Solid base slab underneath (dark stone) to prevent clipping with grass */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[size + 0.5, 0.3, size + 0.5]} />
        <meshToonMaterial {...baseToonProps} />
      </mesh>

      {/* Main floor — single solid box */}
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <boxGeometry args={[size, 0.1, size]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
    </group>
  )
}
