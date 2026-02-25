import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CuttingMat() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.27, 0]}>
        <boxGeometry args={[0.6, 0.01, 0.4]} />
        <meshStandardMaterial color="#228844" flatShading />
      </mesh>
      {[...new Array(6)].map((_, i) => (
        <mesh key={`item-${i}`} position={[-0.25 + i * 0.1, -0.264, 0]}>
          <boxGeometry args={[0.002, 0.001, 0.38]} />
          <meshStandardMaterial color="#44aa66" />
        </mesh>
      ))}
      {[...new Array(4)].map((_, i) => (
        <mesh key={`item-${i}`} position={[0, -0.264, -0.15 + i * 0.1]}>
          <boxGeometry args={[0.58, 0.001, 0.002]} />
          <meshStandardMaterial color="#44aa66" />
        </mesh>
      ))}
    </group>
  )
}
