import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AdjustableSpanner() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.02, 0.3, 0.005]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.04, 0.005]} />
        <meshStandardMaterial color="#aaaacc" flatShading />
      </mesh>
      <mesh position={[0.015, 0.12, 0]}>
        <boxGeometry args={[0.02, 0.05, 0.005]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.03, 0.06, 0.01]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0, 0.08, 0.004]}>
        <cylinderGeometry args={[0.008, 0.008, 0.003, 6]} />
        <meshStandardMaterial color="#666677" flatShading />
      </mesh>
    </group>
  )
}
