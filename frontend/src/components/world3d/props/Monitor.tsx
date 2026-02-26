import { getToonMaterialProps } from '../utils/toonMaterials'

interface MonitorProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Thin box monitor sitting on a desk surface.
 * Blue-white emissive screen face for a glowing effect.
 */
export function Monitor({ position = [0, 0, 0], rotation = [0, 0, 0] }: MonitorProps) {
  const frameToon = getToonMaterialProps('#333333')
  const baseToon = getToonMaterialProps('#444444')

  const screenWidth = 0.7
  const screenHeight = 0.45
  const screenDepth = 0.04

  return (
    <group position={position} rotation={rotation}>
      {/* Monitor base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.3, 0.04, 0.2]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Stand neck */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.06]} />
        <meshToonMaterial {...frameToon} />
      </mesh>

      {/* Screen frame */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[screenWidth + 0.06, screenHeight + 0.06, screenDepth]} />
        <meshToonMaterial {...frameToon} />
      </mesh>

      {/* Screen face (glowing) */}
      <mesh position={[0, 0.38, screenDepth / 2 + 0.01]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshStandardMaterial
          color="#E8F0FE"
          emissive="#A0C4FF"
          emissiveIntensity={0.4}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}
