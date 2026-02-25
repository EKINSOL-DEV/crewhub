import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function KeyLight() {
  const groupRef = useRef<THREE.Group>(null)
  const panelRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1
    if (panelRef.current) {
      const i = 1 + Math.sin(s.clock.elapsedTime * 1.5) * 0.5
      ;(panelRef.current.material as any).emissiveIntensity = i
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.25, 0.25, 0.02]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh ref={panelRef} position={[0, 0.05, 0.012]}>
        <boxGeometry args={[0.22, 0.22, 0.002]} />
        <meshStandardMaterial color="#ffffee" emissive="#ffffee" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, -0.15, -0.05]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 4]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, -0.28, -0.05]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 6]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
    </group>
  )
}
