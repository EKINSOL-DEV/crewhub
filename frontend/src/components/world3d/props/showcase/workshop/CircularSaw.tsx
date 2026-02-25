import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CircularSaw() {
  const groupRef = useRef<THREE.Group>(null)
  const bladeRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.25) * 0.08
    if (bladeRef.current) bladeRef.current.rotation.y = s.clock.elapsedTime * 6
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.3, 0.05, 0.2]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <group ref={bladeRef} position={[0, -0.1, 0]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.003, 16]} />
          <meshStandardMaterial color="#ccccdd" metalness={0.8} roughness={0.1} flatShading />
        </mesh>
      </group>
      <mesh position={[0.1, -0.14, 0.08]}>
        <boxGeometry args={[0.06, 0.06, 0.04]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[-0.12, -0.15, 0]}>
        <boxGeometry args={[0.06, 0.03, 0.04]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
    </group>
  )
}
