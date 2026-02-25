import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MonitorStand() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
  })
  return (
    <group ref={groupRef}>
      {/* Base platform */}
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[0.8, 0.04, 0.35]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {/* Riser */}
      <mesh position={[0, -0.2, -0.1]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* Arm */}
      <mesh position={[0, 0.05, 0.05]}>
        <boxGeometry args={[0.06, 0.06, 0.25]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* VESA mount */}
      <mesh position={[0, 0.05, 0.2]}>
        <boxGeometry args={[0.15, 0.15, 0.03]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Cable clip */}
      <mesh position={[0, -0.1, -0.12]}>
        <torusGeometry args={[0.04, 0.01, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
      {/* USB hub underneath */}
      <mesh position={[0.2, -0.42, 0]}>
        <boxGeometry args={[0.25, 0.03, 0.08]} />
        <meshStandardMaterial color="#222233" />
      </mesh>
      {/* USB ports */}
      {[0, 1, 2].map((i) => (
        <mesh key={`item-${i}`} position={[0.12 + i * 0.06, -0.42, 0.045]}>
          <boxGeometry args={[0.03, 0.015, 0.01]} />
          <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1} />
        </mesh>
      ))}
    </group>
  )
}
