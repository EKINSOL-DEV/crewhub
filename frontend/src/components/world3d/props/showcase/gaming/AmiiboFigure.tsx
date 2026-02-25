import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function AmiiboFigure() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
      groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.28, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.015, 8]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.035, 0.2, 6]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#ffcc88" flatShading />
      </mesh>
      {[-0.04, 0.04].map((x, i) => (
        <mesh key={i} position={[x, -0.18, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 4]} />
          <meshStandardMaterial color="#4488ff" flatShading />
        </mesh>
      ))}
    </group>
  )
}
