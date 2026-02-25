import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CableSleeve() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`item-${i}`} position={[0, -0.2 + i * 0.06, 0]}>
          <torusGeometry args={[0.025, 0.01, 4, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#ff00ff' : '#222233'} flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.5, 4]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
    </group>
  )
}
