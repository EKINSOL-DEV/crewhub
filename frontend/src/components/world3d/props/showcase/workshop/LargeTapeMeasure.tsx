import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function LargeTapeMeasure() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 8]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <torusGeometry args={[0.07, 0.003, 4, 12]} />
        <meshStandardMaterial color="#eeaa11" flatShading />
      </mesh>
      <mesh position={[0.1, -0.15, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.003]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0.14, -0.15, 0]}>
        <boxGeometry args={[0.005, 0.015, 0.005]} />
        <meshStandardMaterial color="#222222" flatShading />
      </mesh>
      <mesh position={[-0.04, -0.12, 0.03]}>
        <boxGeometry args={[0.02, 0.02, 0.005]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
    </group>
  )
}
