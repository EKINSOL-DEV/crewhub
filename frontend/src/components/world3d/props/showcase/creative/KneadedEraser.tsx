import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function KneadedEraser() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
      groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.22, 0]}>
        <dodecahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#bbbbcc" flatShading />
      </mesh>
      <mesh position={[0.03, -0.2, 0.02]}>
        <boxGeometry args={[0.02, 0.01, 0.01]} />
        <meshStandardMaterial color="#aaaaaa" flatShading />
      </mesh>
    </group>
  )
}
