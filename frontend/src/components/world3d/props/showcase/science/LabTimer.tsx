import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function LabTimer() {
  const groupRef = useRef<THREE.Group>(null)
  const displayRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.1
    if (displayRef.current)
      (displayRef.current.material as any).emissiveIntensity =
        1 + Math.sin(s.clock.elapsedTime * 2) * 0.5
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 8]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh ref={displayRef} position={[0, -0.145, 0.04]}>
        <boxGeometry args={[0.08, 0.02, 0.002]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, -0.12, 0.04]}>
        <boxGeometry args={[0.03, 0.01, 0.005]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0.03, -0.12, 0.04]}>
        <boxGeometry args={[0.02, 0.01, 0.005]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
    </group>
  )
}
