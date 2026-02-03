import { useToonMaterialProps } from './utils/toonMaterials'

interface BuildingFloorProps {
  width: number
  depth: number
  color?: string
}

/**
 * Single large floor slab for the entire office building.
 * Sits at y=0, acts as the base for all rooms and hallways.
 */
export function BuildingFloor({ width, depth, color = '#D4C4A8' }: BuildingFloorProps) {
  const floorToon = useToonMaterialProps(color)

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <boxGeometry args={[width, depth, 0.15]} />
      <meshToonMaterial {...floorToon} />
    </mesh>
  )
}
