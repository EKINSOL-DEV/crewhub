import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Screwdriver() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.4
  })
  return (
    <group ref={groupRef} rotation={[0, 0, -0.2]}>
      {/* Handle */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.35, 8]} />
        <meshStandardMaterial color="#ff6622" flatShading />
      </mesh>
      {/* Handle grip lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={`item-${i}`} position={[0, -0.25 + i * 0.06, 0]} rotation={[0, i * 0.5, 0]}>
          <torusGeometry args={[0.058, 0.004, 4, 8]} />
          <meshStandardMaterial color="#dd5511" />
        </mesh>
      ))}
      {/* Handle cap */}
      <mesh position={[0, -0.35, 0]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#ff6622" flatShading />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Phillips tip */}
      <mesh position={[0, 0.33, 0]}>
        <coneGeometry args={[0.02, 0.04, 4]} />
        <meshStandardMaterial color="#999aaa" />
      </mesh>
    </group>
  )
}
