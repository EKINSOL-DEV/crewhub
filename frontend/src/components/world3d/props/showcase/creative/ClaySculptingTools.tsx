import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ClaySculptingTools() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.3, 0.01, 0.1]} />
        <meshStandardMaterial color="#aa8855" flatShading />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group
          key={`item-${i}`}
          position={[-0.1 + i * 0.05, -0.15, 0]}
          rotation={[0, 0, (i - 2) * 0.05]}
        >
          <mesh>
            <cylinderGeometry args={[0.006, 0.008, 0.15, 6]} />
            <meshStandardMaterial color="#bb9966" flatShading />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.01, 3, 3]} />
            <meshStandardMaterial color="#aaaacc" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}
