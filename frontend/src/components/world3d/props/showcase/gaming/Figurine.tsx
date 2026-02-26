import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Figurine() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.5
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 8]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Feet */}
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, -0.48, 0.02]}>
          <boxGeometry args={[0.06, 0.08, 0.1]} />
          <meshStandardMaterial color="#4444aa" flatShading />
        </mesh>
      ))}
      {/* Legs */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, -0.35, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.06]} />
          <meshStandardMaterial color="#4444aa" flatShading />
        </mesh>
      ))}
      {/* Body */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.2, 0.3, 0.12]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {/* Arms */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, -0.1, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
          <boxGeometry args={[0.05, 0.25, 0.05]} />
          <meshStandardMaterial color="#ffcc88" flatShading />
        </mesh>
      ))}
      {/* Head */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#ffcc88" flatShading />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.09, 5, 5]} />
        <meshStandardMaterial color="#553322" flatShading />
      </mesh>
      {/* Sword */}
      <mesh position={[0.22, -0.05, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.03, 0.4, 0.015]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      <mesh position={[0.2, -0.22, 0]}>
        <boxGeometry args={[0.1, 0.02, 0.03]} />
        <meshStandardMaterial color="#aa8833" />
      </mesh>
    </group>
  )
}
