import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface GlowOrbProps {
  color?: string
  position?: [number, number, number]
  size?: number
  pulseSpeed?: number
  intensity?: number
  wireframe?: boolean
}

/**
 * Pulsing glowing sphere with optional wireframe shell.
 *
 * Usage:
 *   <GlowOrb color="#00ffff" position={[0, 1, 0]} />
 *   <GlowOrb color="#aa44ff" size={0.5} pulseSpeed={2} />
 *   <GlowOrb color="#ff4488" wireframe intensity={2} />
 */
export function GlowOrb({
  color = '#00ffff',
  position = [0, 0, 0],
  size = 0.3,
  pulseSpeed = 1.5,
  intensity = 2,
  wireframe = true,
}: GlowOrbProps) {
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = 0.95 + Math.sin(t * pulseSpeed * Math.PI) * 0.05

    if (innerRef.current) {
      innerRef.current.scale.setScalar(pulse)
      const mat = innerRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = intensity * (0.8 + 0.2 * Math.sin(t * pulseSpeed * Math.PI))
    }
    if (outerRef.current) {
      outerRef.current.rotation.y += 0.005
      outerRef.current.rotation.x = Math.sin(t * 0.3) * 0.2
      outerRef.current.scale.setScalar(1.02 + Math.sin(t * pulseSpeed * 0.7) * 0.03)
    }
  })

  return (
    <group position={position}>
      {/* Inner solid glow */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[size * 0.7, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={intensity}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Outer wireframe shell */}
      {wireframe && (
        <mesh ref={outerRef}>
          <icosahedronGeometry args={[size, 1]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={intensity * 0.5}
            transparent
            opacity={0.15}
            wireframe
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Point light for ambient glow */}
      <pointLight color={color} intensity={intensity * 0.5} distance={size * 8} decay={2} />
    </group>
  )
}
