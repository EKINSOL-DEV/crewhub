import { useToonMaterialProps, WARM_COLORS } from '../utils/toonMaterials'

interface BenchProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

/**
 * Simple park/office bench: wooden slats on metal frame.
 */
export function Bench({ position = [0, 0, 0], rotation = [0, 0, 0] }: BenchProps) {
  const woodToon = useToonMaterialProps(WARM_COLORS.woodLight)
  const metalToon = useToonMaterialProps('#555555')

  const seatWidth = 1.6
  const seatDepth = 0.45
  const seatHeight = 0.45
  const slatThickness = 0.06
  const legWidth = 0.06

  return (
    <group position={position} rotation={rotation}>
      {/* Metal legs (2 A-frame supports) */}
      {[-seatWidth / 2 + 0.2, seatWidth / 2 - 0.2].map((x, i) => (
        <group key={i}>
          {/* Front leg */}
          <mesh position={[x, seatHeight / 2, seatDepth / 2 - 0.05]} castShadow>
            <boxGeometry args={[legWidth, seatHeight, legWidth]} />
            <meshToonMaterial {...metalToon} />
          </mesh>
          {/* Back leg */}
          <mesh position={[x, seatHeight / 2, -seatDepth / 2 + 0.05]} castShadow>
            <boxGeometry args={[legWidth, seatHeight, legWidth]} />
            <meshToonMaterial {...metalToon} />
          </mesh>
          {/* Cross brace */}
          <mesh position={[x, seatHeight * 0.3, 0]}>
            <boxGeometry args={[legWidth, legWidth, seatDepth - 0.1]} />
            <meshToonMaterial {...metalToon} />
          </mesh>
        </group>
      ))}

      {/* Seat slats (3 wooden planks) */}
      {[-0.12, 0, 0.12].map((zOff, i) => (
        <mesh key={`seat-${i}`} position={[0, seatHeight + slatThickness / 2, zOff]} castShadow>
          <boxGeometry args={[seatWidth, slatThickness, 0.1]} />
          <meshToonMaterial {...woodToon} />
        </mesh>
      ))}

      {/* Back rest (2 slats) — slightly tilted back */}
      {[0.15, 0.35].map((yOff, i) => (
        <mesh
          key={`back-${i}`}
          position={[0, seatHeight + slatThickness + yOff, -seatDepth / 2 + 0.04]}
          rotation={[0.15, 0, 0]}
          castShadow
        >
          <boxGeometry args={[seatWidth, slatThickness, 0.08]} />
          <meshToonMaterial {...woodToon} />
        </mesh>
      ))}

      {/* Back rest metal supports */}
      {[-seatWidth / 2 + 0.2, seatWidth / 2 - 0.2].map((x, i) => (
        <mesh key={`backleg-${i}`} position={[x, seatHeight + 0.3, -seatDepth / 2 + 0.04]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[legWidth, 0.55, legWidth]} />
          <meshToonMaterial {...metalToon} />
        </mesh>
      ))}
    </group>
  )
}
