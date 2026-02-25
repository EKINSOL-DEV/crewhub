import { useToonMaterialProps } from './utils/toonMaterials'

interface BuildingFloorProps {
  readonly width: number
  readonly depth: number
  readonly color?: string
}

/**
 * Single large floor slab for the entire office building.
 * Sits at y=0, acts as the base for all rooms and hallways.
 */
export function BuildingFloor({ width, depth, color = '#D4C4A8' }: BuildingFloorProps) {
  const floorToon = useToonMaterialProps(color)

  // Inset floor slightly so it doesn't peek out beyond the building walls.
  // Wall thickness is 0.35, so pull the floor in by that amount on each side.
  const wallThickness = 0.35
  const floorWidth = width - wallThickness * 2
  const floorDepth = depth - wallThickness * 2

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <boxGeometry args={[floorWidth, floorDepth, 0.15]} />
      <meshToonMaterial {...floorToon} />
    </mesh>
  )
}
