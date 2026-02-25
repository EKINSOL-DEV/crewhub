import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CClamp() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.02, 0.2, 0.12]} />
        <meshStandardMaterial color="#ff6622" flatShading />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.02]} />
        <meshStandardMaterial color="#ff6622" flatShading />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.02]} />
        <meshStandardMaterial color="#ff6622" flatShading />
      </mesh>
      <mesh position={[0.07, -0.1, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 6]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0.07, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
    </group>
  )
}
