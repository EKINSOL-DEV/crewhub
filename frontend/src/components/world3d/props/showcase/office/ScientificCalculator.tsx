import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ScientificCalculator() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.2, 0.32, 0.02]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, 0.06, 0.012]}>
        <boxGeometry args={[0.16, 0.06, 0.002]} />
        <meshStandardMaterial color="#88bbaa" emissive="#88bbaa" emissiveIntensity={0.5} />
      </mesh>
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={`item-${i % 4}-${Math.floor(i / 4)}`}
          position={[-0.06 + (i % 4) * 0.04, -0.04 - Math.floor(i / 4) * 0.035, 0.012]}
        >
          <boxGeometry args={[0.03, 0.025, 0.005]} />
          <meshStandardMaterial color={i < 4 ? '#ff6644' : '#555566'} flatShading />
        </mesh>
      ))}
    </group>
  )
}
