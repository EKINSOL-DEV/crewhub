import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function TorqueWrench() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.012, 0.015, 0.4, 6]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.04, 0.08, 0.03]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.03, 6]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0.02, -0.1, 0.015]}>
        <boxGeometry args={[0.02, 0.015, 0.002]} />
        <meshStandardMaterial color="#44ccaa" emissive="#44ccaa" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}
