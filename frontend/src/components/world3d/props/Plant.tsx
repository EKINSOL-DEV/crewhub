import { getToonMaterialProps } from '../utils/toonMaterials'

interface PlantProps {
  readonly position?: [number, number, number]
  readonly scale?: number
  readonly potColor?: string
}

/**
 * Simple decorative potted plant: cylinder pot + green sphere foliage.
 */
export function Plant({ position = [0, 0, 0], scale = 1, potColor = '#8B6238' }: PlantProps) {
  const potToon = getToonMaterialProps(potColor)
  const dirtToon = getToonMaterialProps('#5A3E2B')
  const leafToon = getToonMaterialProps('#4A8B3F')
  const leafLightToon = getToonMaterialProps('#6BAF5B')

  return (
    <group position={position} scale={scale}>
      {/* Pot */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.16, 0.3, 12]} />
        <meshToonMaterial {...potToon} />
      </mesh>

      {/* Pot rim */}
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 12]} />
        <meshToonMaterial {...potToon} />
      </mesh>

      {/* Dirt */}
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 12]} />
        <meshToonMaterial {...dirtToon} />
      </mesh>

      {/* Main foliage sphere */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshToonMaterial {...leafToon} />
      </mesh>

      {/* Secondary foliage spheres for volume */}
      <mesh position={[0.1, 0.52, 0.08]} castShadow>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshToonMaterial {...leafLightToon} />
      </mesh>
      <mesh position={[-0.08, 0.5, -0.06]} castShadow>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshToonMaterial {...leafLightToon} />
      </mesh>

      {/* Small stem */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.12, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#5A8A3C')} />
      </mesh>
    </group>
  )
}
