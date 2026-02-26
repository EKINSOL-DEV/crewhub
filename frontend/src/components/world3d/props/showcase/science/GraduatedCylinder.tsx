import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GraduatedCylinder() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.4, 8]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.2} flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.045, 0.25, 8]} />
        <meshStandardMaterial color="#4488ff" transparent opacity={0.3} flatShading />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={JSON.stringify(_)} position={[0.055, -0.2 + i * 0.06, 0]}>
          <boxGeometry args={[0.01, 0.002, 0.001]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.01, 8]} />
        <meshStandardMaterial color="#ccddee" flatShading />
      </mesh>
    </group>
  )
}
