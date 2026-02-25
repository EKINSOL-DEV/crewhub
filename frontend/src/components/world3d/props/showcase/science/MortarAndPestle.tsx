import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MortarAndPestle() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.18, 0]}>
        <sphereGeometry args={[0.12, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.02, 6]} />
        <meshStandardMaterial color="#999aaa" flatShading />
      </mesh>
      <mesh position={[0.06, -0.05, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.015, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
      <mesh position={[0.14, -0.12, 0]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
    </group>
  )
}
