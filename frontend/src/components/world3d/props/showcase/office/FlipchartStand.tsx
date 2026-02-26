import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FlipchartStand() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.02]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.55, 0.03, 0.03]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, -0.2, -0.1]} rotation={[0.15, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 4]} />
          <meshStandardMaterial color="#888899" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.08, 0.015]}>
        <boxGeometry args={[0.45, 0.5, 0.003]} />
        <meshStandardMaterial color="#fffff8" flatShading />
      </mesh>
      <mesh position={[-0.05, 0.25, 0.02]}>
        <boxGeometry args={[0.2, 0.01, 0.001]} />
        <meshStandardMaterial color="#ff2244" flatShading />
      </mesh>
    </group>
  )
}
