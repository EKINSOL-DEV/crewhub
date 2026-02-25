import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DeskOrganizerTray() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.25]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      {[-0.15, 0.05].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, -0.08, 0]}>
          <boxGeometry args={[0.01, 0.1, 0.23]} />
          <meshStandardMaterial color="#eebb33" flatShading />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`x-${i}`}
          position={[-0.22 + i * 0.04, 0.0, 0]}
          rotation={[0, 0, 0.05 * (i - 1)]}
        >
          <cylinderGeometry args={[0.008, 0.008, 0.15, 6]} />
          <meshStandardMaterial color={['#4488ff', '#ff4444', '#222222'][i]} flatShading />
        </mesh>
      ))}
      <mesh position={[0.18, -0.1, 0]}>
        <boxGeometry args={[0.08, 0.04, 0.06]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[-0.03, -0.09, 0.05]}>
        <boxGeometry args={[0.08, 0.04, 0.08]} />
        <meshStandardMaterial color="#ff88cc" flatShading />
      </mesh>
    </group>
  )
}
