import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function NailGun() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.08, 0.15, 0.06]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0, -0.2, 0.04]}>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0, 0.01, 0.04]}>
        <boxGeometry args={[0.04, 0.04, 0.03]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.16, -0.01]}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 4]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0.06]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}
