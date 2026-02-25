import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PaperShredder() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.35, 0.25, 0.2]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.15]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.15, 0.002]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {[...Array(6)].map((_, i) => (
        <mesh key={`item-${i}`} position={[-0.08 + i * 0.03, -0.25, 0]}>
          <boxGeometry args={[0.008, 0.15, 0.002]} />
          <meshStandardMaterial color="#ffffff" flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.32, 0.2, 0.18]} />
        <meshStandardMaterial color="#ccccdd" transparent opacity={0.4} flatShading />
      </mesh>
    </group>
  )
}
