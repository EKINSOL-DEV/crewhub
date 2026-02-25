import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Thermometer() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Glass tube */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
        <meshStandardMaterial color="#ddddee" transparent opacity={0.3} />
      </mesh>
      {/* Mercury column */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.55, 6]} />
        <meshStandardMaterial color="#ff2244" />
      </mesh>
      {/* Bulb */}
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ff2244" />
      </mesh>
      {/* Scale marks */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0.04, -0.3 + i * 0.07, 0]}>
          <boxGeometry args={[0.02, 0.003, 0.001]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* Top cap */}
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.02, 6]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
    </group>
  )
}
