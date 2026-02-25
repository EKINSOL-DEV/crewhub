import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function EnvelopeOpener() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.02, 0.3, 0.005]} />
        <meshStandardMaterial color="#ccbb88" metalness={0.6} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.015, 0.08, 0.003]} />
        <meshStandardMaterial color="#ddcc99" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.015, 0.1, 6]} />
        <meshStandardMaterial color="#884422" flatShading />
      </mesh>
    </group>
  )
}
