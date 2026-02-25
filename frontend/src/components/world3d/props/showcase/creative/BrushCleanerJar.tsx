import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BrushCleanerJar() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.1, 0.09, 0.25, 8]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.3} flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.15, 8]} />
        <meshStandardMaterial color="#8899bb" transparent opacity={0.4} flatShading />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={`item-${i}`} position={[(i - 1) * 0.03, 0.05, 0]} rotation={[0, 0, (i - 1) * 0.1]}>
          <cylinderGeometry args={[0.006, 0.006, 0.2, 4]} />
          <meshStandardMaterial color={['#884422', '#664411', '#aa6633'][i]} flatShading />
        </mesh>
      ))}
    </group>
  )
}
