import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Router() {
  const groupRef = useRef<THREE.Group>(null)
  const ledsRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
    if (ledsRef.current)
      ledsRef.current.children.forEach((l, i) => {
        const mat = (l as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat.emissiveIntensity !== undefined)
          mat.emissiveIntensity = Math.sin(s.clock.elapsedTime * 2 + i) > 0 ? 3 : 0.5
      })
  })
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.5]} />
        <meshStandardMaterial color="#1a1a2e" flatShading />
      </mesh>
      {/* Top */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.78, 0.03, 0.48]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      {/* Ventilation */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-0.2 + i * 0.08, -0.28, 0]}>
          <boxGeometry args={[0.04, 0.005, 0.3]} />
          <meshStandardMaterial color="#111122" />
        </mesh>
      ))}
      {/* Antennas */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <group key={i}>
          <mesh position={[x, -0.05, -0.2]} rotation={[0.15, 0, (i - 1) * 0.1]}>
            <cylinderGeometry args={[0.02, 0.015, 0.6, 6]} />
            <meshStandardMaterial color="#333355" />
          </mesh>
          <mesh position={[x, 0.22, -0.2]}>
            <sphereGeometry args={[0.025, 4, 4]} />
            <meshStandardMaterial color="#333355" />
          </mesh>
        </group>
      ))}
      {/* LEDs */}
      <group ref={ledsRef}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-0.2 + i * 0.1, -0.285, 0.24]}>
            <sphereGeometry args={[0.012, 4, 4]} />
            <meshStandardMaterial
              color={i < 3 ? '#00ff66' : '#ff8800'}
              emissive={i < 3 ? '#00ff66' : '#ff8800'}
              emissiveIntensity={2}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}
