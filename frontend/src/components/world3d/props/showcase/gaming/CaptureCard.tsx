import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CaptureCard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.18, 0.03, 0.1]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      <mesh position={[0, -0.185, 0]}>
        <boxGeometry args={[0.15, 0.005, 0.08]} />
        <meshStandardMaterial color="#333355" flatShading />
      </mesh>
      <mesh position={[0.06, -0.18, 0.04]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[-0.08, -0.2, 0.05]}>
        <boxGeometry args={[0.025, 0.015, 0.005]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0.08, -0.2, 0.05]}>
        <boxGeometry args={[0.025, 0.015, 0.005]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
    </group>
  )
}
