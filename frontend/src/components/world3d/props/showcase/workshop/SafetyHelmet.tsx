import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SafetyHelmet() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Shell */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.35, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#ffcc00" flatShading />
      </mesh>
      {/* Brim */}
      <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.03, 4, 12]} />
        <meshStandardMaterial color="#eebb00" flatShading />
      </mesh>
      {/* Inner suspension */}
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.3, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#ffffff" flatShading side={THREE.BackSide} />
      </mesh>
      {/* Headband straps */}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.01, 4, 12]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>
      {/* Front logo area */}
      <mesh position={[0, 0.1, 0.33]}>
        <boxGeometry args={[0.12, 0.06, 0.001]} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
      {/* Chin strap */}
      <mesh position={[-0.2, -0.15, 0.15]}>
        <boxGeometry args={[0.02, 0.15, 0.02]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0.2, -0.15, 0.15]}>
        <boxGeometry args={[0.02, 0.15, 0.02]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}
