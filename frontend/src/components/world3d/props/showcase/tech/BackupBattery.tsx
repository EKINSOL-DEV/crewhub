import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BackupBattery() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.15, 0.25, 0.06]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`item-${i}`} position={[-0.02 + i * 0.02, -0.04, 0.032]}>
          <boxGeometry args={[0.01, 0.02, 0.002]} />
          <meshStandardMaterial
            color={i < 3 ? '#44ff44' : '#333344'}
            emissive={i < 3 ? '#44ff44' : '#000000'}
            emissiveIntensity={i < 3 ? 1 : 0}
          />
        </mesh>
      ))}
      <mesh position={[0.05, 0, 0.032]}>
        <sphereGeometry args={[0.006, 4, 4]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}
