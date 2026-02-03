import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'
import type { BotAccessoryType } from './utils/botVariants'

interface BotAccessoryProps {
  type: BotAccessoryType
  color: string
}

/**
 * Per-type bot accessory — sits on TOP of the head (head top ≈ y=0.48).
 *
 * - Worker: Yellow crown/hat
 * - Thinker: Antenna with glowing lightbulb
 * - Cron: Antenna with clock face
 * - Comms: Antenna with signal waves
 * - Dev: Antenna with gear/cog
 */
export function BotAccessory({ type, color }: BotAccessoryProps) {
  switch (type) {
    case 'crown':     return <Crown />
    case 'lightbulb': return <LightbulbAntenna />
    case 'clock':     return <ClockAntenna color={color} />
    case 'signal':    return <SignalAntenna color={color} />
    case 'gear':      return <GearAntenna color={color} />
  }
}

// Head top position (head center y=0.32, height=0.32, so top=0.48)
const HEAD_TOP_Y = 0.48

// ─── Crown / Hat (Worker) ──────────────────────────────────────

function Crown() {
  const toonYellow = useToonMaterialProps('#FFD700')
  const toonDarkYellow = useToonMaterialProps('#DAA520')

  return (
    <group position={[0, HEAD_TOP_Y, 0]}>
      {/* Hat base / brim */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
        <meshToonMaterial {...toonYellow} />
      </mesh>
      {/* Hat dome (taller, like a crown) */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.20, 0.08, 16]} />
        <meshToonMaterial {...toonYellow} />
      </mesh>
      {/* Top knob */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshToonMaterial {...toonDarkYellow} />
      </mesh>
    </group>
  )
}

// ─── Lightbulb Antenna (Thinker) ───────────────────────────────

function LightbulbAntenna() {
  const bulbRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (bulbRef.current) {
      const mat = bulbRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.4
    }
  })

  return (
    <group position={[0, HEAD_TOP_Y, 0]}>
      {/* Antenna stem */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      {/* Lightbulb */}
      <mesh ref={bulbRef} position={[0, 0.19, 0]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial
          color="#FFD700"
          emissive="#FFD700"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Bulb base */}
      <mesh position={[0, 0.145, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.03, 8]} />
        <meshStandardMaterial color="#ccc" metalness={0.4} />
      </mesh>
    </group>
  )
}

// ─── Clock Face Antenna (Cron) ─────────────────────────────────

function ClockAntenna({ color }: { color: string }) {
  const handRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (handRef.current) {
      handRef.current.rotation.z = -clock.getElapsedTime() * 1.5
    }
  })

  return (
    <group position={[0, HEAD_TOP_Y, 0]}>
      {/* Antenna stem */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      {/* Clock face circle */}
      <group position={[0, 0.20, 0]}>
        {/* White clock face (front) */}
        <mesh position={[0, 0, 0.012]} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.045, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* White clock face (back) */}
        <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.045, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Ring border */}
        <mesh>
          <torusGeometry args={[0.045, 0.008, 8, 20]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* Rotating hand */}
        <mesh ref={handRef} position={[0, 0, 0.016]}>
          <boxGeometry args={[0.006, 0.035, 0.003]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Center dot */}
        <mesh position={[0, 0, 0.018]}>
          <sphereGeometry args={[0.005, 6, 6]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  )
}

// ─── Signal Antenna (Comms) ────────────────────────────────────

function SignalAntenna({ color }: { color: string }) {
  const wavesRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!wavesRef.current) return
    const t = clock.getElapsedTime()
    // Pulse the signal waves
    wavesRef.current.children.forEach((child, i) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.3 + Math.sin(t * 3 + i * 1.2) * 0.3
      }
    })
  })

  return (
    <group position={[0, HEAD_TOP_Y, 0]}>
      {/* Antenna stem */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      {/* Antenna ball */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Signal waves (arcs) */}
      <group ref={wavesRef} position={[0, 0.20, 0]}>
        {[0.05, 0.075, 0.1].map((radius, i) => (
          <mesh
            key={i}
            rotation={[0, 0, -Math.PI / 4]}
          >
            <torusGeometry args={[radius, 0.005, 4, 12, Math.PI / 2]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={0.6}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ─── Gear Antenna (Dev) ────────────────────────────────────────

function GearAntenna({ color }: { color: string }) {
  const gearRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (gearRef.current) {
      gearRef.current.rotation.z = clock.getElapsedTime() * 0.8
    }
  })

  return (
    <group position={[0, HEAD_TOP_Y, 0]}>
      {/* Antenna stem */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      {/* Gear */}
      <group ref={gearRef} position={[0, 0.19, 0]}>
        {/* Outer gear teeth */}
        <mesh>
          <torusGeometry args={[0.04, 0.012, 6, 8]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Inner hub */}
        <mesh>
          <circleGeometry args={[0.02, 12]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Back face */}
        <mesh rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.02, 12]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}
