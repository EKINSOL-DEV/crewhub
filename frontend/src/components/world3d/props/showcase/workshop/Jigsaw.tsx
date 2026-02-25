import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Jigsaw() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.08, 0.18, 0.06]} />
        <meshStandardMaterial color="#ff8822" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0.04]}>
        <boxGeometry args={[0.04, 0.06, 0.03]} />
        <meshStandardMaterial color="#ff8822" flatShading />
      </mesh>
      <mesh position={[0, -0.23, 0]}>
        <boxGeometry args={[0.02, 0.1, 0.003]} />
        <meshStandardMaterial color="#ccccdd" flatShading />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.08]} />
        <meshStandardMaterial color="#cc7722" flatShading />
      </mesh>
      <mesh position={[0.03, 0, 0.032]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1.5} />
      </mesh>
    </group>
  )
}
