import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MicrocontrollerKit() {
  const groupRef = useRef<THREE.Group>(null)
  const ledRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.25
    if (ledRef.current)
      (ledRef.current.material as any).emissiveIntensity = 1 + Math.sin(s.clock.elapsedTime * 4) * 1
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.2, 0.015, 0.15]} />
        <meshStandardMaterial color="#2255bb" flatShading />
      </mesh>
      <mesh position={[-0.04, -0.165, 0]}>
        <boxGeometry args={[0.04, 0.01, 0.04]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh position={[0.05, -0.165, -0.03]}>
        <boxGeometry args={[0.025, 0.008, 0.015]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh ref={ledRef} position={[0.06, -0.165, 0.04]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1} />
      </mesh>
      {[...Array(14)].map((_, i) => (
        <mesh key={`item-${i}`} position={[-0.085 + i * 0.013, -0.18, 0.07]}>
          <cylinderGeometry args={[0.002, 0.002, 0.02, 3]} />
          <meshStandardMaterial color="#ccccdd" flatShading />
        </mesh>
      ))}
    </group>
  )
}
