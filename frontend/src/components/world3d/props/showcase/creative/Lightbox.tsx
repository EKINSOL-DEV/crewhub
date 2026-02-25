import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Lightbox() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.45, 0.04, 0.35]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, -0.175, 0]}>
        <boxGeometry args={[0.42, 0.002, 0.32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.47, 0.005, 0.37]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      <mesh position={[0, -0.175, 0]}>
        <boxGeometry args={[0.3, 0.001, 0.22]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
    </group>
  )
}
