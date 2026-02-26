import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GreenScreen() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.01]} />
        <meshStandardMaterial color="#22cc44" flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.75, 0.03, 0.03]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, -0.2, -0.08]} rotation={[0.15, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
          <meshStandardMaterial color="#888899" flatShading />
        </mesh>
      ))}
    </group>
  )
}
