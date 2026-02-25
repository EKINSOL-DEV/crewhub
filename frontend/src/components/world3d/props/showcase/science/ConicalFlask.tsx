import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ConicalFlask() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.15, 0.35, 8]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.2} flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.035, 0.13, 0.2, 8]} />
        <meshStandardMaterial color="#88ddaa" transparent opacity={0.35} flatShading />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 8]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
    </group>
  )
}
