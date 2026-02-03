import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface BotBodyProps {
  color: string
  status: 'active' | 'idle' | 'sleeping' | 'offline'
}

/**
 * Bot body — a rounded capsule/pill shape with toon shading.
 * Includes arms and feet.
 */
export function BotBody({ color, status }: BotBodyProps) {
  const bodyRef = useRef<THREE.Mesh>(null)
  const toonProps = useToonMaterialProps(color)
  const darkToon = useToonMaterialProps('#333333')

  // Subtle breathing animation for sleeping
  useFrame(({ clock }) => {
    if (!bodyRef.current) return
    if (status === 'sleeping') {
      const t = clock.getElapsedTime()
      const breathe = 1 + Math.sin(t * 1.2) * 0.015
      bodyRef.current.scale.set(breathe, 1, breathe)
    } else {
      bodyRef.current.scale.set(1, 1, 1)
    }
  })

  return (
    <group>
      {/* Main body capsule */}
      <mesh ref={bodyRef} position={[0, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.35, 12, 16]} />
        <meshToonMaterial {...toonProps} />
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.24, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.15, 6, 8]} />
        <meshToonMaterial {...toonProps} />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.24, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.15, 6, 8]} />
        <meshToonMaterial {...toonProps} />
      </mesh>

      {/* Left foot */}
      <mesh position={[-0.08, -0.32, 0.04]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.12]} />
        <meshToonMaterial {...darkToon} />
      </mesh>

      {/* Right foot */}
      <mesh position={[0.08, -0.32, 0.04]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.12]} />
        <meshToonMaterial {...darkToon} />
      </mesh>
    </group>
  )
}
