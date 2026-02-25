import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AirbrushKit() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.3, 6]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0.015]}>
        <cylinderGeometry args={[0.015, 0.015, 0.04, 6]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.04, 4]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0.01]}>
        <boxGeometry args={[0.015, 0.04, 0.005]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
    </group>
  )
}
