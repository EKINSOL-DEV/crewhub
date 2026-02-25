import { useToonMaterialProps } from '../utils/toonMaterials'

interface LampProps {
  readonly position?: [number, number, number]
  readonly lightEnabled?: boolean
  readonly lightColor?: string
  readonly lightIntensity?: number
}

/**
 * Simple floor lamp: cylinder pole + sphere on top.
 * Optional point light emitting from the sphere position.
 */
export function Lamp({
  position = [0, 0, 0],
  lightEnabled = true,
  lightColor = '#FFD700',
  lightIntensity = 0.5,
}: LampProps) {
  const poleToon = useToonMaterialProps('#777777')
  const baseToon = useToonMaterialProps('#555555')

  const poleHeight = 1.8
  const poleRadius = 0.03
  const sphereRadius = 0.15
  const baseRadius = 0.18

  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[baseRadius, baseRadius + 0.04, 0.08, 16]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Pole */}
      <mesh position={[0, poleHeight / 2 + 0.08, 0]} castShadow>
        <cylinderGeometry args={[poleRadius, poleRadius, poleHeight, 8]} />
        <meshToonMaterial {...poleToon} />
      </mesh>

      {/* Sphere bulb */}
      <mesh position={[0, poleHeight + 0.08 + sphereRadius, 0]} castShadow>
        <sphereGeometry args={[sphereRadius, 16, 16]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.6} />
      </mesh>

      {/* Point light from sphere */}
      {lightEnabled && (
        <pointLight
          position={[0, poleHeight + 0.08 + sphereRadius, 0]}
          intensity={lightIntensity}
          color={lightColor}
          distance={8}
          castShadow={false}
        />
      )}
    </group>
  )
}
