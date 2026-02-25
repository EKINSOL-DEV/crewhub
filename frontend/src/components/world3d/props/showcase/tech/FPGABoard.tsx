import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FPGABoard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.25]} />
        <meshStandardMaterial color="#225522" flatShading />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.08]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-0.12 + i * 0.05, -0.13, 0.1]}>
          <boxGeometry args={[0.02, 0.015, 0.015]} />
          <meshStandardMaterial color="#aaaacc" flatShading />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.1, -0.135, -0.08 + i * 0.03]}>
          <sphereGeometry args={[0.005, 4, 4]} />
          <meshStandardMaterial
            color={['#ff4444', '#44ff44', '#4488ff', '#ffcc44'][i]}
            emissive={['#ff4444', '#44ff44', '#4488ff', '#ffcc44'][i]}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
      {[...Array(12)].map((_, i) => (
        <mesh key={i} position={[-0.13 + i * 0.024, -0.14, -0.11]}>
          <cylinderGeometry args={[0.003, 0.003, 0.02, 3]} />
          <meshStandardMaterial color="#ccccdd" flatShading />
        </mesh>
      ))}
    </group>
  )
}
