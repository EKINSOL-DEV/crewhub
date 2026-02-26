import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Microscope() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.35]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Arm */}
      <mesh position={[-0.15, -0.1, -0.1]}>
        <boxGeometry args={[0.08, 0.85, 0.08]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {/* Stage */}
      <mesh position={[0, -0.35, 0.05]}>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshStandardMaterial color="#555566" />
      </mesh>
      {/* Stage clips */}
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, -0.33, 0.12]}>
          <boxGeometry args={[0.04, 0.01, 0.06]} />
          <meshStandardMaterial color="#888899" />
        </mesh>
      ))}
      {/* Objective turret */}
      <mesh position={[0, -0.2, 0.05]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 8]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Objectives */}
      {['#ddcc44', '#44aadd', '#dd4444'].map((color, i) => {
        const a = (i / 3) * Math.PI - 0.5
        return (
          <mesh key={color} position={[Math.sin(a) * 0.05, -0.25, 0.05 + Math.cos(a) * 0.05]}>
            <cylinderGeometry args={[0.015, 0.02, 0.08, 6]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
      {/* Eyepiece tube */}
      <mesh position={[0, 0.15, -0.05]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.35, 8]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Eyepiece */}
      <mesh position={[0, 0.3, -0.1]}>
        <cylinderGeometry args={[0.05, 0.04, 0.06, 8]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Focus knobs */}
      {[-0.2, -0.1].map((x, i) => (
        <mesh key={x} position={[x, -0.25, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04 - i * 0.01, 0.04 - i * 0.01, 0.02, 8]} />
          <meshStandardMaterial color="#666677" />
        </mesh>
      ))}
      {/* Light */}
      <mesh position={[0, -0.42, 0.05]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
