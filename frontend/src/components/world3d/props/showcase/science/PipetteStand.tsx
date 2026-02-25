import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PipetteStand() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.25, 0.02, 0.08]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh position={[0, -0.05, -0.03]}>
        <boxGeometry args={[0.25, 0.02, 0.02]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      {[-0.08, 0, 0.08].map((x, i) => (
        <group key={i} position={[x, -0.05, 0.02]}>
          <mesh rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.01, 0.25, 6]} />
            <meshStandardMaterial color={['#4488ff', '#ff4444', '#44cc44'][i]} flatShading />
          </mesh>
        </group>
      ))}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, -0.12, -0.03]}>
          <boxGeometry args={[0.02, 0.18, 0.02]} />
          <meshStandardMaterial color="#ddddee" flatShading />
        </mesh>
      ))}
    </group>
  )
}
