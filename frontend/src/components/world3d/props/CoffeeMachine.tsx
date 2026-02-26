import { getToonMaterialProps } from '../utils/toonMaterials'

interface CoffeeMachineProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Office coffee machine: boxy body with a coffee pot and cup.
 */
export function CoffeeMachine({ position = [0, 0, 0], rotation = [0, 0, 0] }: CoffeeMachineProps) {
  const bodyToon = getToonMaterialProps('#2A2A2A')
  const frontToon = getToonMaterialProps('#3A3A3A')
  const potToon = getToonMaterialProps('#222222')
  const coffeeToon = getToonMaterialProps('#4A2810')
  const cupToon = getToonMaterialProps('#FFFFFF')
  const buttonToon = getToonMaterialProps('#44AA44')
  const redToon = getToonMaterialProps('#CC3333')

  return (
    <group position={position} rotation={rotation}>
      {/* Main body */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>

      {/* Front panel (slightly lighter) */}
      <mesh position={[0, 0.45, 0.201]}>
        <boxGeometry args={[0.42, 0.6, 0.01]} />
        <meshToonMaterial {...frontToon} />
      </mesh>

      {/* Top surface */}
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[0.52, 0.02, 0.42]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>

      {/* Nozzle area (recessed opening) */}
      <mesh position={[0, 0.35, 0.19]}>
        <boxGeometry args={[0.2, 0.2, 0.05]} />
        <meshToonMaterial {...getToonMaterialProps('#1A1A1A')} />
      </mesh>

      {/* Coffee cup sitting in nozzle area */}
      <mesh position={[0, 0.2, 0.19]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.1, 10]} />
        <meshToonMaterial {...cupToon} />
      </mesh>

      {/* Coffee in cup */}
      <mesh position={[0, 0.26, 0.19]}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 10]} />
        <meshToonMaterial {...coffeeToon} />
      </mesh>

      {/* Cup handle */}
      <mesh position={[0.08, 0.2, 0.19]}>
        <torusGeometry args={[0.03, 0.01, 6, 8, Math.PI]} />
        <meshToonMaterial {...cupToon} />
      </mesh>

      {/* Buttons */}
      <mesh position={[-0.1, 0.6, 0.21]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
        <meshToonMaterial {...buttonToon} />
      </mesh>
      <mesh position={[0, 0.6, 0.21]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
        <meshToonMaterial {...redToon} />
      </mesh>
      <mesh position={[0.1, 0.6, 0.21]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
        <meshToonMaterial {...buttonToon} />
      </mesh>

      {/* Drip tray at bottom */}
      <mesh position={[0, 0.11, 0.19]}>
        <boxGeometry args={[0.35, 0.02, 0.15]} />
        <meshToonMaterial {...getToonMaterialProps('#444444')} />
      </mesh>

      {/* Coffee pot on side (carafe) */}
      <mesh position={[-0.35, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.2, 10]} />
        <meshToonMaterial {...potToon} />
      </mesh>
      {/* Coffee in pot */}
      <mesh position={[-0.35, 0.25, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 10]} />
        <meshToonMaterial {...coffeeToon} />
      </mesh>
      {/* Pot handle */}
      <mesh position={[-0.46, 0.22, 0]}>
        <boxGeometry args={[0.03, 0.12, 0.06]} />
        <meshToonMaterial {...potToon} />
      </mesh>
    </group>
  )
}
