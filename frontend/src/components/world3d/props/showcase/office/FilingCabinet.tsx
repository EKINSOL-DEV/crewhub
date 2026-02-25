import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FilingCabinet() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
  })
  return (
    <group ref={groupRef}>
      {/* Cabinet body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 1.2, 0.5]} />
        <meshStandardMaterial color="#778899" flatShading />
      </mesh>
      {/* Drawers */}
      {[0.35, 0.05, -0.25].map((y, i) => (
        <group key={`y-${i}`}>
          <mesh position={[0, y, 0.26]}>
            <boxGeometry args={[0.55, 0.28, 0.02]} />
            <meshStandardMaterial color={i === 1 ? '#8899aa' : '#778899'} flatShading />
          </mesh>
          {/* Handle */}
          <mesh position={[0, y, 0.28]}>
            <boxGeometry args={[0.15, 0.03, 0.03]} />
            <meshStandardMaterial color="#aabbcc" />
          </mesh>
          {/* Label */}
          <mesh position={[0, y - 0.06, 0.27]}>
            <boxGeometry args={[0.12, 0.04, 0.005]} />
            <meshStandardMaterial color="#ffffee" />
          </mesh>
        </group>
      ))}
      {/* Open drawer (middle one pulled out) */}
      <mesh position={[0, 0.05, 0.42]}>
        <boxGeometry args={[0.52, 0.26, 0.3]} />
        <meshStandardMaterial color="#8899aa" flatShading />
      </mesh>
      {/* Files inside */}
      {[-0.15, 0, 0.15].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0.12, 0.42]}>
          <boxGeometry args={[0.08, 0.18, 0.25]} />
          <meshStandardMaterial color={['#ff6644', '#44aa66', '#4488ff'][i]} flatShading />
        </mesh>
      ))}
    </group>
  )
}
