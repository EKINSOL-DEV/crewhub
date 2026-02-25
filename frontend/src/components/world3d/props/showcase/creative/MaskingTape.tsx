import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MaskingTape() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.02, 6, 12]} />
        <meshStandardMaterial color="#eedd88" flatShading />
      </mesh>
      <mesh position={[0.09, -0.2, 0]}>
        <boxGeometry args={[0.03, 0.003, 0.03]} />
        <meshStandardMaterial color="#ddcc77" flatShading />
      </mesh>
    </group>
  )
}
