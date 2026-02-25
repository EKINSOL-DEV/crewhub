import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PaperTrimmer() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[0.45, 0.02, 0.3]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[0, -0.22, -0.1]}>
        <boxGeometry args={[0.45, 0.03, 0.01]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[-0.15, -0.2, -0.1]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.03, 0.06, 0.015]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      <mesh position={[0, -0.23, 0]}>
        <boxGeometry args={[0.3, 0.001, 0.2]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
    </group>
  )
}
