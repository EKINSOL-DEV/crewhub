import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WireCutters() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0.02, -0.1, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      <mesh position={[-0.02, -0.1, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.01]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0.01, 0.04, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.005]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[-0.01, 0.04, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.005]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
    </group>
  )
}
