import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Stapler() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.5) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.42, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.15]} />
        <meshStandardMaterial color="#cc2222" flatShading />
      </mesh>
      {/* Top (jaw) */}
      <mesh position={[0, -0.36, 0]} rotation={[0.05, 0, 0]}>
        <boxGeometry args={[0.48, 0.05, 0.13]} />
        <meshStandardMaterial color="#dd3333" flatShading />
      </mesh>
      {/* Hinge */}
      <mesh position={[-0.22, -0.38, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
      {/* Metal insert */}
      <mesh position={[0.05, -0.39, 0]}>
        <boxGeometry args={[0.3, 0.015, 0.08]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Rubber pad */}
      <mesh position={[0, -0.46, 0]}>
        <boxGeometry args={[0.48, 0.02, 0.13]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  )
}
