import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LEDProps {
  color?: string
  position?: [number, number, number]
  size?: number
  pulse?: boolean
  blinkSpeed?: number
  intensity?: number
}

/**
 * LED indicator light — small glowing sphere that can blink or pulse.
 *
 * Usage:
 *   <LED color="#00ff00" position={[0.1, 0.5, 0.2]} />
 *   <LED color="#ff0000" pulse blinkSpeed={3} />
 *   <LED color="#00aaff" size={0.03} intensity={4} />
 */
export function LED({
  color = '#00ff00',
  position = [0, 0, 0],
  size = 0.02,
  pulse = false,
  blinkSpeed = 2,
  intensity = 3,
}: LEDProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state) => {
    if (!matRef.current) return
    const t = state.clock.elapsedTime
    if (pulse) {
      const v = 0.5 + 0.5 * Math.sin(t * blinkSpeed * Math.PI)
      matRef.current.emissiveIntensity = intensity * v
      matRef.current.opacity = 0.6 + 0.4 * v
    } else {
      // Steady glow with subtle shimmer
      matRef.current.emissiveIntensity = intensity * (0.9 + 0.1 * Math.sin(t * 8))
    }
  })

  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        transparent
        opacity={1}
        toneMapped={false}
      />
    </mesh>
  )
}
