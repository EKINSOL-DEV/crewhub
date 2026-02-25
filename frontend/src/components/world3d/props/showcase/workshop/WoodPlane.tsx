import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WoodPlane() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.12, 0.08, 0.25]} />
        <meshStandardMaterial color="#bb9955" flatShading />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.08, 0.04, 0.08]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      <mesh position={[0, -0.18, 0.02]}>
        <boxGeometry args={[0.02, 0.003, 0.2]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[0.04, -0.15, -0.08]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
    </group>
  )
}
