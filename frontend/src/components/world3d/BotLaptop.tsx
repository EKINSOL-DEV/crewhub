import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface BotLaptopProps {
  /** Whether the laptop should be visible (true when bot is actively working) */
  visible: boolean
}

/**
 * Floating laptop that appears in front of the bot's chest when "working".
 *
 * Geometry: thin box for keyboard base + angled thin box for screen.
 * The screen has a subtle emissive glow. Toon-shaded to match bot art style.
 *
 * Smooth scale transition for appear/disappear.
 * Gentle floating bob animation.
 */
export function BotLaptop({ visible }: BotLaptopProps) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef(visible ? 1 : 0)

  // Shared toon material props
  const baseToon = useToonMaterialProps('#3a3a3e')       // dark laptop body
  const screenFrameToon = useToonMaterialProps('#2a2a30') // slightly darker screen bezel

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return

    // Smooth scale transition for appear/disappear
    const target = visible ? 1 : 0
    const speed = 5 // transition speed multiplier
    scaleRef.current += (target - scaleRef.current) * Math.min(1, speed * delta)
    if (scaleRef.current < 0.01) scaleRef.current = 0
    if (scaleRef.current > 0.99) scaleRef.current = 1

    groupRef.current.scale.setScalar(scaleRef.current)
    groupRef.current.visible = scaleRef.current > 0.01

    // Subtle floating bob animation
    if (scaleRef.current > 0.01) {
      const t = clock.getElapsedTime()
      groupRef.current.position.y = 0.02 + Math.sin(t * 2.5) * 0.006
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.02, 0.27]}>
      {/* ─── Keyboard base — thin flat box, slightly tilted ─── */}
      <mesh rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.22, 0.012, 0.13]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* ─── Screen — hinged from far edge of base, tilted back toward bot ─── */}
      <group position={[0, 0.006, 0.065]} rotation={[-0.35, 0, 0]}>
        {/* Screen frame / bezel */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.21, 0.12, 0.008]} />
          <meshToonMaterial {...screenFrameToon} />
        </mesh>

        {/* Emissive screen panel (facing toward the bot) */}
        <mesh position={[0, 0.06, -0.005]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.17, 0.09]} />
          <meshStandardMaterial
            color="#77bbee"
            emissive="#4499bb"
            emissiveIntensity={0.6}
            side={THREE.FrontSide}
          />
        </mesh>
      </group>
    </group>
  )
}
