import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BindingMachine() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.35, 0.15, 0.2]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0.05]}>
        <boxGeometry args={[0.35, 0.04, 0.08]} />
        <meshStandardMaterial color="#555566" flatShading />
      </mesh>
      <mesh position={[0.15, 0.02, 0.08]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 6]} />
        <meshStandardMaterial color="#ff4444" flatShading />
      </mesh>
      {[...new Array(8)].map((_, i) => (
        <mesh key={`item-${i}`} position={[-0.14 + i * 0.04, -0.04, 0.1]}>
          <cylinderGeometry args={[0.005, 0.005, 0.02, 4]} />
          <meshStandardMaterial color="#aaaacc" flatShading />
        </mesh>
      ))}
    </group>
  )
}
