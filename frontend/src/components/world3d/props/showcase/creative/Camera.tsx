import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Camera() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.3]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Grip */}
      <mesh position={[0.32, -0.05, 0]}>
        <boxGeometry args={[0.08, 0.35, 0.28]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {/* Lens barrel */}
      <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.2, 12]} />
        <meshStandardMaterial color="#444455" flatShading />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, 0, 0.33]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial color="#224488" transparent opacity={0.4} />
      </mesh>
      {/* Lens ring */}
      <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.015, 8, 16]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      {/* Viewfinder */}
      <mesh position={[0, 0.25, -0.05]}>
        <boxGeometry args={[0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* Flash */}
      <mesh position={[-0.15, 0.22, 0.05]}>
        <boxGeometry args={[0.1, 0.04, 0.06]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>
      {/* Shutter button */}
      <mesh position={[0.15, 0.22, 0.05]}>
        <cylinderGeometry args={[0.025, 0.025, 0.03, 6]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
      {/* Screen on back */}
      <mesh position={[0, 0, -0.155]}>
        <planeGeometry args={[0.35, 0.25]} />
        <meshStandardMaterial color="#112244" emissive="#112244" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
