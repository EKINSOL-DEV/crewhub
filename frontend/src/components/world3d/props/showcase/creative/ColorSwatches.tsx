import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ColorSwatches() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      {[...Array(7)].map((_, i) => (
        <mesh
          key={i}
          position={[-0.08 + i * 0.025, -0.12 + i * 0.01, 0]}
          rotation={[0, 0, (i - 3) * 0.05]}
        >
          <boxGeometry args={[0.04, 0.25, 0.003]} />
          <meshStandardMaterial
            color={['#ff4444', '#ff8844', '#ffcc44', '#44cc44', '#4488ff', '#8844ff', '#ff44aa'][i]}
            flatShading
          />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.01, 6]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
    </group>
  )
}
