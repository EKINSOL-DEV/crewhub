import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DeskPhone() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.2]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.15, -0.05]}>
        <boxGeometry args={[0.2, 0.06, 0.08]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.11, -0.04]}>
        <boxGeometry args={[0.12, 0.03, 0.002]} />
        <meshStandardMaterial color="#44ccaa" emissive="#44ccaa" emissiveIntensity={0.8} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh
          key={`item-${i}`}
          position={[-0.04 + (i % 3) * 0.04, -0.175, -0.04 + Math.floor(i / 3) * 0.03]}
        >
          <boxGeometry args={[0.025, 0.005, 0.02]} />
          <meshStandardMaterial color="#555566" flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.13, 0.08]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.06]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
    </group>
  )
}
