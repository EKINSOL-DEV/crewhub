import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
}

/**
 * Solid room floor — single box with toon shading.
 * Much simpler and more performant than the old per-tile grid.
 */
export function RoomFloor({ color, size = 12 }: RoomFloorProps) {
  const baseColor = color || '#9E9684'
  const toonProps = useToonMaterialProps(baseColor)

  return (
    <group>
      {/* Main floor — single solid box, thick enough to prevent grass clipping */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[size, 0.4, size]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
    </group>
  )
}
