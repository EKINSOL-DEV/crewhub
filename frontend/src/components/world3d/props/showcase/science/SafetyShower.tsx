import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SafetyShower() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0.12, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 4]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.25, 0.015, 0.015]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      <mesh position={[0.12, 0.1, 0.04]}>
        <boxGeometry args={[0.06, 0.03, 0.01]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      {[...Array(3)].map((_, i) => (
        <mesh key={i} position={[(i - 1) * 0.02, 0.28, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.06, 3]} />
          <meshStandardMaterial color="#88ccff" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  )
}
