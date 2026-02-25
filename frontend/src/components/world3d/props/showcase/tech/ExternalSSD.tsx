import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ExternalSSD() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.15, 0.02, 0.1]} />
        <meshStandardMaterial color="#333355" flatShading />
      </mesh>
      <mesh position={[0, -0.19, 0]}>
        <boxGeometry args={[0.13, 0.005, 0.08]} />
        <meshStandardMaterial color="#444466" flatShading />
      </mesh>
      <mesh position={[0.06, -0.185, 0.04]}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, -0.19, 0]}>
        <boxGeometry args={[0.06, 0.003, 0.03]} />
        <meshStandardMaterial color="#4466aa" flatShading />
      </mesh>
    </group>
  )
}
