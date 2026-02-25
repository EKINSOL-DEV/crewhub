import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WatercolorSet() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.35, 0.03, 0.18]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {[
        '#ff4444',
        '#ff8844',
        '#ffcc44',
        '#44cc44',
        '#4488ff',
        '#4444cc',
        '#884488',
        '#aa5533',
        '#222222',
        '#ffffff',
        '#ff88aa',
        '#88ddff',
      ].map((c, i) => (
        <mesh key={i} position={[-0.13 + (i % 6) * 0.053, -0.18, -0.04 + Math.floor(i / 6) * 0.06]}>
          <boxGeometry args={[0.04, 0.01, 0.04]} />
          <meshStandardMaterial color={c} flatShading />
        </mesh>
      ))}
      <mesh position={[-0.14, -0.18, 0.07]}>
        <cylinderGeometry args={[0.006, 0.004, 0.08, 4]} />
        <meshStandardMaterial color="#884422" flatShading />
      </mesh>
    </group>
  )
}
