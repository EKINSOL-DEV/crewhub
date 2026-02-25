import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DeskMat() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.8, 0.01, 0.35]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      <mesh position={[0, -0.275, 0]}>
        <boxGeometry args={[0.82, 0.005, 0.37]} />
        <meshStandardMaterial color="#334466" flatShading />
      </mesh>
      <mesh position={[0.25, -0.27, 0.1]}>
        <boxGeometry args={[0.06, 0.002, 0.03]} />
        <meshStandardMaterial color="#4466aa" flatShading />
      </mesh>
    </group>
  )
}
