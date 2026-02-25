import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function HandSanitizer() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.25, 8]} />
        <meshStandardMaterial color="#88ddff" transparent opacity={0.5} flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.18, 8]} />
        <meshStandardMaterial color="#44ccff" transparent opacity={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.06, 6]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0.05, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 4]} />
        <meshStandardMaterial color="#dddddd" flatShading />
      </mesh>
      <mesh position={[0, -0.12, 0.082]}>
        <boxGeometry args={[0.1, 0.12, 0.002]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
    </group>
  )
}
