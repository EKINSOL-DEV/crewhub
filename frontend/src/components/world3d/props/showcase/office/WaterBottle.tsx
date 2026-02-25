import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WaterBottle() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.7, 8]} />
        <meshStandardMaterial color="#4488dd" transparent opacity={0.6} flatShading />
      </mesh>
      {/* Water inside */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.45, 8]} />
        <meshStandardMaterial color="#66bbff" transparent opacity={0.4} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 0.1, 8]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Cap top */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.05, 0.1, 0.06, 8]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -0.46, 0]}>
        <cylinderGeometry args={[0.16, 0.14, 0.04, 8]} />
        <meshStandardMaterial color="#3366aa" flatShading />
      </mesh>
      {/* Brand stripe */}
      <mesh position={[0, -0.05, 0.151]}>
        <boxGeometry args={[0.12, 0.06, 0.001]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}
