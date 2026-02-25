import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MouseBungee() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 8]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[0.03, 0.008, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0.03, 0.02, 0]} rotation={[0.3, 0, 0.3]}>
        <cylinderGeometry args={[0.005, 0.005, 0.15, 4]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
    </group>
  )
}
