import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Coaster() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.27, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.015, 8]} />
        <meshStandardMaterial color="#cc9955" flatShading />
      </mesh>
      <mesh position={[0, -0.26, 0]}>
        <torusGeometry args={[0.07, 0.005, 4, 8]} />
        <meshStandardMaterial color="#aa7733" flatShading />
      </mesh>
      <mesh position={[0, -0.262, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.002, 6]} />
        <meshStandardMaterial color="#885522" flatShading />
      </mesh>
    </group>
  )
}
