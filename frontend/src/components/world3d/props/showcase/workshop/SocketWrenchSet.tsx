import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SocketWrenchSet() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.35, 0.02, 0.2]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {[...new Array(8)].map((_, i) => (
        <mesh
          key={`item-${i}`}
          position={[-0.12 + (i % 4) * 0.08, -0.18, -0.04 + Math.floor(i / 4) * 0.08]}
        >
          <cylinderGeometry args={[0.015 + i * 0.002, 0.015 + i * 0.002, 0.02, 6]} />
          <meshStandardMaterial color="#aaaacc" flatShading />
        </mesh>
      ))}
      <mesh position={[0.12, -0.18, 0]}>
        <boxGeometry args={[0.04, 0.015, 0.12]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
    </group>
  )
}
