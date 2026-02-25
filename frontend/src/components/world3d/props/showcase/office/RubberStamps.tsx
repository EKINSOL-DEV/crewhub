import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function RubberStamps() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      {[
        ['#ff4444', -0.1],
        ['#4488ff', 0.05],
        ['#44cc44', 0.2],
      ].map(([c, x], i) => (
        <group key={i} position={[(x as number) - 0.05, -0.18, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.08, 0.06, 0.04]} />
            <meshStandardMaterial color="#aa7744" flatShading />
          </mesh>
          <mesh position={[0, -0.01, 0]}>
            <boxGeometry args={[0.07, 0.02, 0.035]} />
            <meshStandardMaterial color={c as string} flatShading />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.4, 0.01, 0.06]} />
        <meshStandardMaterial color="#cc4444" flatShading />
      </mesh>
    </group>
  )
}
