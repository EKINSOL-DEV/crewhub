import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
}

/**
 * Room floor — thin colored overlay sitting on top of the building floor.
 * Just provides the room-specific color; the building floor is underneath.
 */
export function RoomFloor({ color, size = 12 }: RoomFloorProps) {
  const baseColor = color || '#9E9684'
  const toonProps = useToonMaterialProps(baseColor)

  return (
    <mesh position={[0, 0.08, 0]} receiveShadow>
      <boxGeometry args={[size, 0.16, size]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}
