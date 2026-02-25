import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Headphones() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Headband */}
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.35, 0.04, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Padding on headband */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.08]} />
        <meshStandardMaterial color="#444455" />
      </mesh>
      {/* Left ear cup */}
      <mesh position={[-0.35, 0.25, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.1, 8]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh position={[-0.35, 0.25, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.12, 8]} />
        <meshStandardMaterial color="#444466" />
      </mesh>
      {/* Right ear cup */}
      <mesh position={[0.35, 0.25, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.1, 8]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      <mesh position={[0.35, 0.25, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.12, 8]} />
        <meshStandardMaterial color="#444466" />
      </mesh>
      {/* RGB accents */}
      <mesh position={[-0.35, 0.25, 0.06]}>
        <ringGeometry args={[0.12, 0.15, 8]} />
        <meshStandardMaterial
          color="#44ffaa"
          emissive="#44ffaa"
          emissiveIntensity={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0.35, 0.25, 0.06]}>
        <ringGeometry args={[0.12, 0.15, 8]} />
        <meshStandardMaterial
          color="#44ffaa"
          emissive="#44ffaa"
          emissiveIntensity={1.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
