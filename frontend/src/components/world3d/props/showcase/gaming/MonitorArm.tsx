import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MonitorArm() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0.15, -0.28, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 8]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0.15, -0.15, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.02]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[-0.15, -0.05, 0]}>
        <boxGeometry args={[0.015, 0.08, 0.015]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[-0.15, -0.1, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.04]} />
        <meshStandardMaterial color="#555566" flatShading />
      </mesh>
    </group>
  )
}
