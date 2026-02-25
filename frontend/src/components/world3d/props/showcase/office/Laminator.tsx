import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Laminator() {
  const groupRef = useRef<THREE.Group>(null)
  const rollerRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.08
    if (rollerRef.current) rollerRef.current.rotation.x = s.clock.elapsedTime * 2
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.15]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh ref={rollerRef} position={[0, -0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
        <meshStandardMaterial color="#888899" flatShading />
      </mesh>
      <mesh position={[-0.25, -0.15, 0]}>
        <boxGeometry args={[0.1, 0.005, 0.1]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} flatShading />
      </mesh>
      <mesh position={[0.25, -0.15, 0]}>
        <boxGeometry args={[0.1, 0.005, 0.1]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.4} flatShading />
      </mesh>
      <mesh position={[0.15, -0.12, 0.08]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} />
      </mesh>
    </group>
  )
}
