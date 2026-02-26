import { getToonMaterialProps, WARM_COLORS } from '../utils/toonMaterials'

interface DeskProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Simple desk: four box legs + thin slab top.
 * Toon-shaded warm wood color.
 */
export function Desk({ position = [0, 0, 0], rotation = [0, 0, 0] }: DeskProps) {
  const woodToon = getToonMaterialProps(WARM_COLORS.wood)
  const topToon = getToonMaterialProps(WARM_COLORS.woodLight)

  const topWidth = 1.6
  const topDepth = 0.8
  const topThickness = 0.08
  const legHeight = 0.7
  const legSize = 0.08
  const topY = legHeight + topThickness / 2

  const legOffsetX = topWidth / 2 - legSize / 2 - 0.05
  const legOffsetZ = topDepth / 2 - legSize / 2 - 0.05

  return (
    <group position={position} rotation={rotation}>
      {/* Table top */}
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[topWidth, topThickness, topDepth]} />
        <meshToonMaterial {...topToon} />
      </mesh>

      {/* Four legs */}
      {[
        [-legOffsetX, legHeight / 2, -legOffsetZ],
        [legOffsetX, legHeight / 2, -legOffsetZ],
        [-legOffsetX, legHeight / 2, legOffsetZ],
        [legOffsetX, legHeight / 2, legOffsetZ],
      ].map((legPos, _i) => (
        <mesh key={JSON.stringify(legPos)} position={legPos as [number, number, number]} castShadow>
          <boxGeometry args={[legSize, legHeight, legSize]} />
          <meshToonMaterial {...woodToon} />
        </mesh>
      ))}
    </group>
  )
}
