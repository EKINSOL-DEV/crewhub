import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DeskMirror() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.015, 12]} />
        <meshStandardMaterial color="#cc9944" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0.008]}>
        <cylinderGeometry args={[0.16, 0.16, 0.003, 12]} />
        <meshStandardMaterial color="#ccddee" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, -0.15, -0.05]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.03, 0.3, 0.01]} />
        <meshStandardMaterial color="#cc9944" flatShading />
      </mesh>
      <mesh position={[0, -0.28, -0.02]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        <meshStandardMaterial color="#cc9944" flatShading />
      </mesh>
    </group>
  )
}
