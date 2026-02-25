import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PottedSucculent() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
      groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.15, 6]} />
        <meshStandardMaterial color="#cc6644" flatShading />
      </mesh>
      <mesh position={[0, -0.11, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.03, 6]} />
        <meshStandardMaterial color="#553322" flatShading />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[Math.cos((i * Math.PI) / 3) * 0.06, -0.04, Math.sin((i * Math.PI) / 3) * 0.06]}
          rotation={[0.4, (i * Math.PI) / 3, 0]}
        >
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshStandardMaterial color="#66cc88" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#88ddaa" flatShading />
      </mesh>
    </group>
  )
}
