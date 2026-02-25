import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function TrashCan() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.2, 0.17, 0.45, 8]} />
        <meshStandardMaterial color="#667788" flatShading />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <torusGeometry args={[0.2, 0.015, 6, 8]} />
        <meshStandardMaterial color="#889aaa" flatShading />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.03, 8]} />
        <meshStandardMaterial color="#778899" flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.01, 4, 8]} />
        <meshStandardMaterial color="#99aabb" flatShading />
      </mesh>
      <mesh position={[0.15, -0.3, 0]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#556677" flatShading />
      </mesh>
    </group>
  )
}
