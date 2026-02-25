import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ConferenceSpeakerphone() {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.15
    if (ringRef.current) {
      const i = 0.8 + Math.sin(s.clock.elapsedTime * 3) * 0.4
      ;(ringRef.current.material as any).emissiveIntensity = i
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.24, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh ref={ringRef} position={[0, -0.215, 0]}>
        <torusGeometry args={[0.15, 0.005, 4, 12]} />
        <meshStandardMaterial color="#44ff88" emissive="#44ff88" emissiveIntensity={0.8} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={`item-${i}`}
          position={[
            Math.cos((i * Math.PI * 2) / 3) * 0.1,
            -0.215,
            Math.sin((i * Math.PI * 2) / 3) * 0.1,
          ]}
        >
          <cylinderGeometry args={[0.015, 0.015, 0.01, 6]} />
          <meshStandardMaterial color="#444455" flatShading />
        </mesh>
      ))}
      <mesh position={[0, -0.21, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.01, 6]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
    </group>
  )
}
