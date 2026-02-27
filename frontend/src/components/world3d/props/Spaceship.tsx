import { getToonMaterialProps } from '../utils/toonMaterials'

interface SpaceshipProps {
  readonly position?: [number, number, number]
  readonly scale?: number
}

export function Spaceship({ position = [0, 0, 0], scale = 1 }: SpaceshipProps) {
  const hull = getToonMaterialProps('#B8B8B8')
  const dark = getToonMaterialProps('#555555')
  const accent = getToonMaterialProps('#4488CC')
  const wing = getToonMaterialProps('#777777')
  const nozzle = getToonMaterialProps('#333333')

  return (
    <group position={position} scale={scale}>
      {/* Main fuselage */}
      <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.18, 0.9, 12]} />
        <meshToonMaterial {...hull} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0.35, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.08, 0.3, 12]} />
        <meshToonMaterial {...hull} />
      </mesh>
      {/* Cockpit dome */}
      <mesh position={[0, 0.44, -0.25]} castShadow>
        <sphereGeometry args={[0.07, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#66BBAA" emissive="#66BBAA" emissiveIntensity={0.4} />
      </mesh>
      {/* Left wing */}
      <mesh position={[-0.3, 0.3, 0.1]} rotation={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[0.4, 0.03, 0.35]} />
        <meshToonMaterial {...wing} />
      </mesh>
      {/* Right wing */}
      <mesh position={[0.3, 0.3, 0.1]} rotation={[0, 0, 0.15]} castShadow>
        <boxGeometry args={[0.4, 0.03, 0.35]} />
        <meshToonMaterial {...wing} />
      </mesh>
      {/* Left wing tip */}
      <mesh position={[-0.48, 0.27, 0.05]} castShadow>
        <boxGeometry args={[0.04, 0.08, 0.15]} />
        <meshToonMaterial {...accent} />
      </mesh>
      {/* Right wing tip */}
      <mesh position={[0.48, 0.27, 0.05]} castShadow>
        <boxGeometry args={[0.04, 0.08, 0.15]} />
        <meshToonMaterial {...accent} />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0, 0.5, 0.2]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.03, 0.18, 0.2]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Engine housing */}
      <mesh position={[0, 0.35, 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.15, 12]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Engine nozzle outer */}
      <mesh position={[0, 0.35, 0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.1, 12]} />
        <meshToonMaterial {...nozzle} />
      </mesh>
      {/* Engine glow */}
      <mesh position={[0, 0.35, 0.58]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.04, 12]} />
        <meshStandardMaterial color="#FF8C00" emissive="#FF8C00" emissiveIntensity={0.8} />
      </mesh>
      {/* Left engine pod */}
      <mesh position={[-0.22, 0.28, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.2, 8]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Left pod glow */}
      <mesh position={[-0.22, 0.28, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#FF8C00" emissive="#FF8C00" emissiveIntensity={0.6} />
      </mesh>
      {/* Right engine pod */}
      <mesh position={[0.22, 0.28, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.2, 8]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Right pod glow */}
      <mesh position={[0.22, 0.28, 0.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#FF8C00" emissive="#FF8C00" emissiveIntensity={0.6} />
      </mesh>
      {/* Accent stripe left */}
      <mesh position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.185, 0.02, 12]} />
        <meshToonMaterial {...accent} />
      </mesh>
      {/* Landing gear front */}
      <mesh position={[0, 0.08, -0.25]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Landing gear front wheel */}
      <mesh position={[0, 0.01, -0.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.025, 0.01, 6, 10]} />
        <meshToonMaterial {...nozzle} />
      </mesh>
      {/* Landing gear rear left */}
      <mesh position={[-0.12, 0.08, 0.25]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Landing gear rear right */}
      <mesh position={[0.12, 0.08, 0.25]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
        <meshToonMaterial {...dark} />
      </mesh>
      {/* Nav light left */}
      <mesh position={[-0.5, 0.28, 0.1]} castShadow>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#CC4444" emissive="#CC4444" emissiveIntensity={0.7} />
      </mesh>
      {/* Nav light right */}
      <mesh position={[0.5, 0.28, 0.1]} castShadow>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#39FF14" emissive="#39FF14" emissiveIntensity={0.7} />
      </mesh>
    </group>
  )
}
