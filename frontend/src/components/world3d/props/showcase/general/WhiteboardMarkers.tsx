import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WhiteboardMarkers() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      {/* Board */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.9, 0.6, 0.03]} />
        <meshStandardMaterial color="#f0f0f0" flatShading />
      </mesh>
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[0.95, 0.65, 0.01]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, -0.2, 0.04]}>
        <boxGeometry args={[0.4, 0.03, 0.04]} />
        <meshStandardMaterial color="#aaaabb" flatShading />
      </mesh>
      {['#ff2244', '#2244ff', '#22cc44', '#111111'].map((c, i) => (
        <mesh key={`c-${i}`} position={[-0.12 + i * 0.08, -0.19, 0.06]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
          <meshStandardMaterial color={c} flatShading />
        </mesh>
      ))}
      <mesh position={[-0.1, 0.2, 0.02]}>
        <boxGeometry args={[0.3, 0.01, 0.001]} />
        <meshStandardMaterial color="#2244ff" flatShading />
      </mesh>
      <mesh position={[0.1, 0.1, 0.02]}>
        <boxGeometry args={[0.25, 0.01, 0.001]} />
        <meshStandardMaterial color="#ff2244" flatShading />
      </mesh>
    </group>
  )
}
