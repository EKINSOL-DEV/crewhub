import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function HeadsetStand() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 8]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Pole */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.75, 6]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Top hook */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {/* Headset on stand */}
      <mesh position={[0, 0.28, 0]}>
        <torusGeometry args={[0.2, 0.025, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#1a1a2e" flatShading />
      </mesh>
      {/* Ear cups */}
      {[-0.2, 0.2].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.28, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 8]} />
            <meshStandardMaterial color="#1a1a2e" flatShading />
          </mesh>
          {/* RGB ring */}
          <mesh position={[x, 0.28, 0.035]}>
            <ringGeometry args={[0.06, 0.09, 8]} />
            <meshStandardMaterial
              color="#ff44ff"
              emissive="#ff44ff"
              emissiveIntensity={2}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
      {/* RGB on base */}
      <mesh position={[0, -0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.19, 0.008, 4, 16]} />
        <meshStandardMaterial color="#00ffaa" emissive="#00ffaa" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
