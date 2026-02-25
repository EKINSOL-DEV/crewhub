import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AllenKeySet() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} position={[0, -0.15, 0]} rotation={[0, 0, i * 0.15 - 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.004 + i * 0.001, 0.004 + i * 0.001, 0.1 + i * 0.02, 4]} />
            <meshStandardMaterial color="#888899" flatShading />
          </mesh>
          <mesh position={[0.02 + i * 0.003, 0.05 + i * 0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004 + i * 0.001, 0.004 + i * 0.001, 0.04 + i * 0.005, 4]} />
            <meshStandardMaterial color="#888899" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}
