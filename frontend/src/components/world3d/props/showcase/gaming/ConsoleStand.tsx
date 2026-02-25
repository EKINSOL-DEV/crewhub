import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ConsoleStand() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.15]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, -0.18, 0]}>
          <boxGeometry args={[0.03, 0.04, 0.12]} />
          <meshStandardMaterial color="#222233" flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.19, 0.076]}>
        <boxGeometry args={[0.15, 0.005, 0.002]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1} />
      </mesh>
      {[-0.1, 0, 0.1].map((z, i) => (
        <mesh key={`z-${i}`} position={[0, -0.24, z]}>
          <boxGeometry args={[0.2, 0.002, 0.01]} />
          <meshStandardMaterial color="#333344" flatShading />
        </mesh>
      ))}
    </group>
  )
}
