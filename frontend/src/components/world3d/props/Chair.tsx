import { useToonMaterialProps } from '../utils/toonMaterials'

interface ChairProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Simple office chair: cylinder seat + thin box back rest.
 * Dark toon-shaded color.
 */
export function Chair({ position = [0, 0, 0], rotation = [0, 0, 0] }: ChairProps) {
  const seatToon = useToonMaterialProps('#3A3A3A')
  const legToon = useToonMaterialProps('#555555')

  const seatRadius = 0.3
  const seatHeight = 0.08
  const legHeight = 0.35
  const backHeight = 0.5
  const backThickness = 0.06

  return (
    <group position={position} rotation={rotation}>
      {/* Center pole */}
      <mesh position={[0, legHeight / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, legHeight, 8]} />
        <meshToonMaterial {...legToon} />
      </mesh>

      {/* Base star (simplified as a wider cylinder) */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.06, 8]} />
        <meshToonMaterial {...legToon} />
      </mesh>

      {/* Seat */}
      <mesh position={[0, legHeight + seatHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[seatRadius, seatRadius, seatHeight, 16]} />
        <meshToonMaterial {...seatToon} />
      </mesh>

      {/* Back rest */}
      <mesh
        position={[0, legHeight + seatHeight + backHeight / 2, -seatRadius + backThickness / 2]}
        castShadow
      >
        <boxGeometry args={[seatRadius * 1.6, backHeight, backThickness]} />
        <meshToonMaterial {...seatToon} />
      </mesh>
    </group>
  )
}
