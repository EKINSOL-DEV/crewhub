import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DropperBottle() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.18, 6]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.3} flatShading />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 6]} />
        <meshStandardMaterial color="#ff8844" transparent opacity={0.4} flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.015, 0.025, 0.06, 6]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.005, 0.01, 0.04, 4]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
    </group>
  )
}
