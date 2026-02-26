import { getToonMaterialProps } from '../utils/toonMaterials'

interface WaterCoolerProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Office water cooler: cylindrical body + water bottle on top.
 */
export function WaterCooler({ position = [0, 0, 0], rotation = [0, 0, 0] }: WaterCoolerProps) {
  const bodyToon = getToonMaterialProps('#E8E8E8')
  const bottleToon = getToonMaterialProps('#C8E0F8')
  const baseToon = getToonMaterialProps('#AAAAAA')
  const tapToon = getToonMaterialProps('#888888')

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.35, 0.7, 0.35]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>

      {/* Water bottle on top */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.5, 12]} />
        <meshToonMaterial {...bottleToon} />
      </mesh>

      {/* Bottle neck */}
      <mesh position={[0, 0.73, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.08, 8]} />
        <meshToonMaterial {...bottleToon} />
      </mesh>

      {/* Bottle cap (dome) */}
      <mesh position={[0, 1.26, 0]}>
        <sphereGeometry args={[0.14, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial {...bottleToon} />
      </mesh>

      {/* Tap/spigot */}
      <mesh position={[0.18, 0.55, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
        <meshToonMaterial {...tapToon} />
      </mesh>

      {/* Drip tray */}
      <mesh position={[0.18, 0.35, 0]}>
        <boxGeometry args={[0.12, 0.02, 0.15]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
    </group>
  )
}
