import { Html } from '@react-three/drei'
import { Float } from '@react-three/drei'
import { Bench } from './props/Bench'
import { CoffeeMachine } from './props/CoffeeMachine'
import { WaterCooler } from './props/WaterCooler'
import { Plant } from './props/Plant'
import { Lamp } from './props/Lamp'
import { useToonMaterialProps } from './utils/toonMaterials'

interface ParkingArea3DProps {
  /** Center position of the parking area */
  position: [number, number, number]
  width: number
  depth: number
}

/**
 * Parking / Break Room area within the office building.
 * Contains a bench, coffee machine, water cooler, plants, and signage.
 * This is where "parked" sessions visually reside.
 */
export function ParkingArea3D({ position, width, depth }: ParkingArea3DProps) {
  const halfW = width / 2
  const halfD = depth / 2
  const dividerToon = useToonMaterialProps('#B0A890')
  const accentToon = useToonMaterialProps('#8B7D6B')

  return (
    <group position={position}>
      {/* ─── Divider line on the left side (separating from work rooms) ─── */}
      <mesh position={[-halfW - 0.1, 0.1, 0]}>
        <boxGeometry args={[0.08, 0.2, depth - 2]} />
        <meshToonMaterial {...dividerToon} />
      </mesh>

      {/* Small posts along divider */}
      {Array.from({ length: Math.floor(depth / 4) }, (_, i) => {
        const z = -halfD + 2 + i * 4
        return (
          <mesh key={`post-${i}`} position={[-halfW - 0.1, 0.3, z]}>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
            <meshToonMaterial {...accentToon} />
          </mesh>
        )
      })}

      {/* ─── Floating sign: "☕ Break Room" ─── */}
      <Float speed={1.5} rotationIntensity={0} floatIntensity={0.2}>
        <group position={[0, 2.5, -halfD + 1]}>
          {/* Sign backing */}
          <mesh castShadow>
            <boxGeometry args={[3, 0.7, 0.12]} />
            <meshToonMaterial {...useToonMaterialProps('#6B4F12')} />
          </mesh>

          {/* Front face */}
          <mesh position={[0, 0, 0.065]}>
            <boxGeometry args={[2.7, 0.5, 0.01]} />
            <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
          </mesh>

          {/* Text */}
          <Html zIndexRange={[1, 5]}
            position={[0, 0, 0.08]}
            center
            transform
            distanceFactor={4}
          >
            <span style={{
              color: '#4A3520',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
            }}>
              ☕ Break Room
            </span>
          </Html>

          {/* Support poles */}
          <mesh position={[-1, -0.55, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
            <meshToonMaterial {...useToonMaterialProps('#6B4F12')} />
          </mesh>
          <mesh position={[1, -0.55, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
            <meshToonMaterial {...useToonMaterialProps('#6B4F12')} />
          </mesh>
        </group>
      </Float>

      {/* ─── Props (compact layout for smaller break room) ─── */}

      {/* Bench — center of break area */}
      <Bench
        position={[0, 0.16, -0.5]}
        rotation={[0, 0, 0]}
      />

      {/* Coffee machine — back corner */}
      <CoffeeMachine
        position={[halfW - 1.2, 0.16, -halfD + 1.5]}
        rotation={[0, -Math.PI / 6, 0]}
      />

      {/* Water cooler — opposite corner */}
      <WaterCooler
        position={[-halfW + 1.2, 0.16, -halfD + 1.5]}
        rotation={[0, Math.PI / 4, 0]}
      />

      {/* Plants — two corners only */}
      <Plant position={[halfW - 0.8, 0.16, halfD - 1]} scale={0.8} />
      <Plant position={[-halfW + 0.8, 0.16, halfD - 1]} scale={0.7} />

      {/* Lamp for ambient lighting */}
      <Lamp
        position={[halfW - 1, 0.16, 0.5]}
        lightColor="#FFA500"
        lightIntensity={0.3}
      />

      {/* Small table between benches */}
      <group position={[0, 0.16, 0.5]}>
        {/* Table top */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.04, 12]} />
          <meshToonMaterial {...useToonMaterialProps('#A5822E')} />
        </mesh>
        {/* Table leg */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.4, 8]} />
          <meshToonMaterial {...useToonMaterialProps('#777777')} />
        </mesh>
        {/* Table base */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 8]} />
          <meshToonMaterial {...useToonMaterialProps('#666666')} />
        </mesh>
      </group>

      {/* Removed parking spot floor markings — they caused visual clipping artifacts */}
    </group>
  )
}
