import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface DataStreamProps {
  readonly position?: [number, number, number]
  readonly count?: number
  readonly radius?: number
  readonly height?: number
  readonly color?: string
  readonly speed?: number
  readonly particleSize?: number
}

/**
 * Flowing data particles orbiting in a column or ring.
 *
 * Usage:
 *   <DataStream position={[0, 0.5, 0]} color="#ff88ff" />
 *   <DataStream count={16} radius={0.8} height={1} speed={2} />
 *   <DataStream color="#00ffff" particleSize={0.04} />
 */
export function DataStream({
  position = [0, 0, 0],
  count = 10,
  radius = 0.5,
  height = 0.8,
  color = '#ff88ff',
  speed = 1,
  particleSize = 0.03,
}: DataStreamProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])

  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        yOffset: (i / count) * height,
        speedMul: 0.8 + Math.random() * 0.4,
        sizeMul: 0.7 + Math.random() * 0.6,
        isBox: Math.random() > 0.5,
      })),
    [count, height]
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    bits.forEach((b, i) => {
      const mesh = meshRefs.current[i]
      if (!mesh) return
      const angle = b.angle + t * b.speedMul
      const y = (b.yOffset + t * 0.2 * b.speedMul) % height
      mesh.position.x = Math.cos(angle) * radius
      mesh.position.z = Math.sin(angle) * radius
      mesh.position.y = y
      mesh.rotation.y = angle
      mesh.rotation.x = t * 2

      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 1.5 + Math.sin(t * 3 + b.angle) * 0.5
    })
  })

  return (
    <group position={position}>
      {bits.map((b, i) => (
        <mesh
          key={JSON.stringify(b)}
          ref={(el) => {
            meshRefs.current[i] = el
          }}
        >
          {b.isBox ? (
            <boxGeometry
              args={[particleSize * b.sizeMul, particleSize * b.sizeMul, particleSize * b.sizeMul]}
            />
          ) : (
            <octahedronGeometry args={[particleSize * b.sizeMul * 0.7, 0]} />
          )}
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}
