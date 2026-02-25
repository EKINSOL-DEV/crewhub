import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BadgeHolder() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
      groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.15, 0.008, 4, 8]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.12, 0.16, 0.005]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 0.0, 0.003]}>
        <boxGeometry args={[0.06, 0.06, 0.002]} />
        <meshStandardMaterial color="#ddccbb" flatShading />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.01]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, -0.06 - i * 0.025, 0.003]}>
          <boxGeometry args={[0.08, 0.005, 0.001]} />
          <meshStandardMaterial color="#333344" />
        </mesh>
      ))}
    </group>
  )
}
