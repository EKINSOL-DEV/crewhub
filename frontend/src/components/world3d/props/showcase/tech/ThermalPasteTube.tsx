import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ThermalPasteTube() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 0.2, 6]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.015, 0.04, 6]} />
        <meshStandardMaterial color="#aaaabb" flatShading />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.02, 4]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0.027]}>
        <boxGeometry args={[0.03, 0.1, 0.002]} />
        <meshStandardMaterial color="#444466" flatShading />
      </mesh>
    </group>
  )
}
