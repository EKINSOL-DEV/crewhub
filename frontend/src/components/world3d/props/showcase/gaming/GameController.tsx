import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GameController() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.15, 0.35]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Grips */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={i} position={[x, -0.1, 0.05]}>
          <cylinderGeometry args={[0.06, 0.07, 0.2, 8]} />
          <meshStandardMaterial color="#1a1a2e" flatShading />
        </mesh>
      ))}
      {/* D-Pad */}
      <mesh position={[-0.15, 0.08, 0.02]}>
        <boxGeometry args={[0.1, 0.02, 0.03]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      <mesh position={[-0.15, 0.08, 0.02]}>
        <boxGeometry args={[0.03, 0.02, 0.1]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Face buttons */}
      {[
        [0.1, 0.05],
        [0.15, 0],
        [0.2, 0.05],
        [0.15, 0.1],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.02, 8]} />
          <meshStandardMaterial
            color={['#44ff44', '#ff4444', '#4488ff', '#ffcc44'][i]}
            emissive={['#44ff44', '#ff4444', '#4488ff', '#ffcc44'][i]}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      {/* Analog sticks */}
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.1, -0.08]}>
          <cylinderGeometry args={[0.035, 0.03, 0.04, 8]} />
          <meshStandardMaterial color="#333344" />
        </mesh>
      ))}
      {/* Center button */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.02, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      {/* Triggers */}
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.06, -0.17]}>
          <boxGeometry args={[0.1, 0.04, 0.04]} />
          <meshStandardMaterial color="#333344" />
        </mesh>
      ))}
      {/* Light bar */}
      <mesh position={[0, 0.05, 0.18]}>
        <boxGeometry args={[0.3, 0.01, 0.01]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={3} />
      </mesh>
    </group>
  )
}
