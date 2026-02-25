import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GamingKeyboard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.55, 0.025, 0.18]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      {[...Array(30)].map((_, i) => (
        <mesh key={`item-${i}`} position={[-0.22 + (i % 10) * 0.05, -0.2, -0.06 + Math.floor(i / 10) * 0.05]}>
          <boxGeometry args={[0.035, 0.015, 0.035]} />
          <meshStandardMaterial
            color={i === 3 || i === 13 || i === 23 ? '#ff4444' : '#222233'}
            flatShading
          />
        </mesh>
      ))}
      <mesh position={[0, -0.2, 0.08]}>
        <boxGeometry args={[0.18, 0.012, 0.03]} />
        <meshStandardMaterial color="#ff44ff" emissive="#ff44ff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
