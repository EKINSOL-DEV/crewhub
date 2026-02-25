import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SDCardReader() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.23, 0]}>
        <boxGeometry args={[0.1, 0.02, 0.06]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0.02, -0.22, 0]}>
        <boxGeometry args={[0.04, 0.015, 0.035]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      <mesh position={[-0.03, -0.215, 0.03]}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[-0.06, -0.23, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.05, 4]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
    </group>
  )
}
