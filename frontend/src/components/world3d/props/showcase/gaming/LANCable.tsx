import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function LANCable() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <torusGeometry args={[0.12, 0.012, 6, 16]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      <mesh position={[0.12, -0.1, 0]}>
        <torusGeometry args={[0.08, 0.012, 6, 12]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      <mesh position={[0.2, -0.05, 0]}>
        <boxGeometry args={[0.02, 0.04, 0.015]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
      <mesh position={[-0.12, -0.05, 0]}>
        <boxGeometry args={[0.02, 0.04, 0.015]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
    </group>
  )
}
