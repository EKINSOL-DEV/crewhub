import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WirelessCharger() {
  const groupRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.2
    if (ringRef.current) {
      const i = 1 + Math.sin(s.clock.elapsedTime * 2) * 0.8
      ;(ringRef.current.material as any).emissiveIntensity = i
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 12]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh ref={ringRef} position={[0, -0.245, 0]}>
        <torusGeometry args={[0.08, 0.008, 6, 12]} />
        <meshStandardMaterial color="#44aaff" emissive="#44aaff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, -0.245, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.002, 6]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[-0.12, -0.27, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.1, 4]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
    </group>
  )
}
