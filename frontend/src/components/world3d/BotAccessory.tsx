import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

type AccessoryType = 'hardhat' | 'antenna' | 'clock' | 'headset' | 'gear'

interface BotAccessoryProps {
  type: AccessoryType
  color: string
}

/**
 * Per-type bot accessory — one of: hardhat, antenna, clock, headset, gear.
 */
export function BotAccessory({ type, color }: BotAccessoryProps) {
  switch (type) {
    case 'hardhat': return <HardHat color={color} />
    case 'antenna': return <Antenna color={color} />
    case 'clock':   return <ClockFace color={color} />
    case 'headset': return <Headset color={color} />
    case 'gear':    return <GearIcon color={color} />
  }
}

// ─── Hard Hat (Worker) ─────────────────────────────────────────

function HardHat({ color }: { color: string }) {
  const toonProps = useToonMaterialProps(color)
  return (
    <group position={[0, 0.48, 0]}>
      {/* Dome */}
      <mesh>
        <sphereGeometry args={[0.18, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
      {/* Brim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.24, 20]} />
        <meshToonMaterial {...toonProps} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ─── Antenna with Glowing Tip (Thinker) ────────────────────────

function Antenna({ color }: { color: string }) {
  const bulbRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (bulbRef.current) {
      const mat = bulbRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.4
    }
  })

  return (
    <group position={[0, 0.52, 0]}>
      {/* Stem */}
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      {/* Glowing bulb */}
      <mesh ref={bulbRef} position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#ffeb3b" emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

// ─── Clock Face on Chest (Cron) ────────────────────────────────

function ClockFace({ color }: { color: string }) {
  const handRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (handRef.current) {
      handRef.current.rotation.z = -clock.getElapsedTime() * 1.5
    }
  })

  return (
    <group position={[0, 0.1, 0.19]}>
      {/* White clock face */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 20]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Ring border */}
      <mesh position={[0, 0, 0.012]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.085, 0.008, 6, 20]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Rotating hour hand */}
      <mesh ref={handRef} position={[0, 0, 0.015]}>
        <boxGeometry args={[0.008, 0.055, 0.004]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Center dot */}
      <mesh position={[0, 0, 0.016]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

// ─── Headset (Comms) ───────────────────────────────────────────

function Headset({ color }: { color: string }) {
  const toonProps = useToonMaterialProps(color)
  return (
    <group position={[0, 0.36, 0]}>
      {/* Headband arc (torus segment over the top) */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.2, 0.018, 8, 16, Math.PI]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
      {/* Left ear cup */}
      <mesh position={[-0.2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
      {/* Right ear cup */}
      <mesh position={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...toonProps} />
      </mesh>
      {/* Microphone arm */}
      <mesh position={[-0.22, -0.08, 0.08]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      {/* Mic tip */}
      <mesh position={[-0.19, -0.14, 0.08]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

// ─── Gear on Chest (Dev) ───────────────────────────────────────

function GearIcon({ color }: { color: string }) {
  const gearRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (gearRef.current) {
      gearRef.current.rotation.z = clock.getElapsedTime() * 0.8
    }
  })

  return (
    <group position={[0, 0.1, 0.19]}>
      <group ref={gearRef}>
        {/* Outer teeth ring */}
        <mesh>
          <torusGeometry args={[0.06, 0.016, 6, 6]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Inner hub */}
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, 0.03, 12]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
