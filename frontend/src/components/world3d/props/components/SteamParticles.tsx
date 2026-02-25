import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SteamParticlesProps {
  position?: [number, number, number]
  count?: number
  spread?: number
  height?: number
  color?: string
  speed?: number
  size?: number
}

/**
 * Rising steam/smoke particle effect — small fading spheres that drift upward.
 *
 * Usage:
 *   <SteamParticles position={[0, 0.8, 0]} />
 *   <SteamParticles count={20} spread={0.3} color="#ffddaa" />
 *   <SteamParticles height={1} speed={0.5} size={0.02} />
 */
export function SteamParticles({
  position = [0, 0, 0],
  count = 12,
  spread = 0.15,
  height = 0.5,
  color = '#ffffff',
  speed = 1,
  size = 0.015,
}: SteamParticlesProps) {
  const groupRef = useRef<THREE.Group>(null)

  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * spread,
        z: (Math.random() - 0.5) * spread,
        offset: Math.random() * Math.PI * 2,
        speedMul: 0.7 + Math.random() * 0.6,
        sizeMul: 0.8 + Math.random() * 0.4,
      })),
    [count, spread]
  )

  const meshRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    particles.forEach((p, i) => {
      const mesh = meshRefs.current[i]
      if (!mesh) return
      const progress = ((t * p.speedMul + p.offset) % (Math.PI * 2)) / (Math.PI * 2)
      mesh.position.y = progress * height
      mesh.position.x = p.x + Math.sin(t * 0.5 + p.offset) * 0.02
      mesh.position.z = p.z + Math.cos(t * 0.3 + p.offset) * 0.02
      const scale = (size + progress * size * 2) * p.sizeMul
      mesh.scale.setScalar(scale / size)
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, 0.25 * (1 - progress))
    })
  })

  return (
    <group position={position} ref={groupRef}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el
          }}
          position={[p.x, 0, p.z]}
        >
          <sphereGeometry args={[size, 6, 6]} />
          <meshStandardMaterial color={color} transparent opacity={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
