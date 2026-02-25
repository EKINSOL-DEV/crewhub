import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AntiStaticWristStrap() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.015, 6, 12]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      <mesh position={[0.1, -0.15, 0]}>
        <boxGeometry args={[0.04, 0.03, 0.025]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0.14, -0.15, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.15, 4]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
    </group>
  )
}
