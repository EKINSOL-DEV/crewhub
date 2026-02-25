import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Monitor() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
  })
  return (
    <group ref={groupRef}>
      {/* Screen bezel */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.2, 0.75, 0.06]} />
        <meshStandardMaterial color="#1a1a2a" flatShading />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.15, 0.031]}>
        <planeGeometry args={[1.05, 0.6]} />
        <meshStandardMaterial color="#1144aa" emissive="#1144aa" emissiveIntensity={0.8} />
      </mesh>
      {/* Code lines on screen */}
      {[0.15, 0.05, -0.05, -0.15].map((y, i) => (
        <mesh key={i} position={[-0.15 + i * 0.05, 0.15 + y, 0.035]}>
          <boxGeometry args={[0.3 + (i % 3) * 0.1, 0.025, 0.001]} />
          <meshStandardMaterial
            color={['#66ff66', '#ffcc44', '#66aaff', '#ff6688'][i]}
            emissive={['#66ff66', '#ffcc44', '#66aaff', '#ff6688'][i]}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
      {/* Stand neck */}
      <mesh position={[0, -0.25, -0.05]}>
        <boxGeometry args={[0.08, 0.3, 0.08]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Stand base */}
      <mesh position={[0, -0.42, 0]}>
        <boxGeometry args={[0.4, 0.03, 0.25]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Power LED */}
      <mesh position={[0, -0.2, 0.031]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={3} />
      </mesh>
    </group>
  )
}
