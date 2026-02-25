import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SolderingIron() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef} rotation={[0, 0, -0.3]}>
      {/* Handle */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.5, 8]} />
        <meshStandardMaterial color="#ffaa22" flatShading />
      </mesh>
      {/* Grip rubber */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.3, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Metal shaft */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.025, 0.04, 0.35, 6]} />
        <meshStandardMaterial color="#bbbbcc" />
      </mesh>
      {/* Tip */}
      <mesh position={[0, 0.42, 0]}>
        <coneGeometry args={[0.025, 0.12, 6]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Heated tip glow */}
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff4400" emissiveIntensity={4} />
      </mesh>
      <pointLight position={[0, 0.48, 0]} intensity={0.3} color="#ff4400" distance={0.5} />
      {/* Stand */}
      <mesh position={[0.2, -0.45, 0]} rotation={[0, 0, 0.3]}>
        <torusGeometry args={[0.12, 0.015, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
      {/* Stand base */}
      <mesh position={[0.2, -0.5, 0]}>
        <boxGeometry args={[0.3, 0.03, 0.2]} />
        <meshStandardMaterial color="#555555" flatShading />
      </mesh>
    </group>
  )
}
