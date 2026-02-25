import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AngleGrinder() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.22, 8]} />
        <meshStandardMaterial color="#44aa44" flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.01, 12]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.04, 0.08, 0.04]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
        <meshStandardMaterial color="#44aa44" flatShading />
      </mesh>
      <mesh position={[0, -0.1, 0.07]}>
        <torusGeometry args={[0.06, 0.003, 4, 12]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
    </group>
  )
}
