import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BunsenBurner() {
  const groupRef = useRef<THREE.Group>(null)
  const flameRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
    if (flameRef.current) {
      flameRef.current.scale.x = 1 + Math.sin(s.clock.elapsedTime * 8) * 0.1
      flameRef.current.scale.y = 1 + Math.sin(s.clock.elapsedTime * 10) * 0.15
    }
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.25, 0.04, 0.25]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Body tube */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.65, 8]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      {/* Air intake collar */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.08, 8]} />
        <meshStandardMaterial color="#777788" />
      </mesh>
      {/* Gas inlet */}
      <mesh position={[0.06, -0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Rubber tube */}
      <mesh position={[0.15, -0.45, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 4]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Flame */}
      <group ref={flameRef} position={[0, 0.22, 0]}>
        {/* Inner flame (blue) */}
        <mesh position={[0, 0.05, 0]}>
          <coneGeometry args={[0.03, 0.15, 8]} />
          <meshStandardMaterial
            color="#4488ff"
            emissive="#4488ff"
            emissiveIntensity={3}
            transparent
            opacity={0.8}
          />
        </mesh>
        {/* Outer flame */}
        <mesh position={[0, 0.08, 0]}>
          <coneGeometry args={[0.045, 0.2, 8]} />
          <meshStandardMaterial
            color="#66aaff"
            emissive="#4466ff"
            emissiveIntensity={2}
            transparent
            opacity={0.4}
          />
        </mesh>
        <pointLight position={[0, 0.1, 0]} intensity={0.6} color="#4488ff" distance={1.5} />
      </group>
    </group>
  )
}
