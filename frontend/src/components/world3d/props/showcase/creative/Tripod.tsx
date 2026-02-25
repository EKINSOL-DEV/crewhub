import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Tripod() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1
  })
  return (
    <group ref={groupRef}>
      {/* Head plate */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.15, 0.03, 0.15]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Ball head */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* Center column */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Hub */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.06, 8]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Legs */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <group key={`item-${i}`}>
            <mesh
              position={[Math.sin(a) * 0.2, -0.4, Math.cos(a) * 0.2]}
              rotation={[Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35]}
            >
              <cylinderGeometry args={[0.02, 0.015, 0.7, 6]} />
              <meshStandardMaterial color="#444455" />
            </mesh>
            {/* Rubber feet */}
            <mesh position={[Math.sin(a) * 0.35, -0.72, Math.cos(a) * 0.35]}>
              <cylinderGeometry args={[0.02, 0.025, 0.03, 6]} />
              <meshStandardMaterial color="#222222" />
            </mesh>
          </group>
        )
      })}
      {/* Level adjustment knob */}
      <mesh position={[0.06, 0.38, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 6]} />
        <meshStandardMaterial color="#666677" />
      </mesh>
    </group>
  )
}
