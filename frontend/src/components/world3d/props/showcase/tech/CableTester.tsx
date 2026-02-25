import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CableTester() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.12, 0.22, 0.04]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      <mesh position={[0, 0.02, 0.022]}>
        <boxGeometry args={[0.06, 0.04, 0.002]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1} />
      </mesh>
      {[...new Array(8)].map((_, i) => (
        <mesh
          key={`item-${i}`}
          position={[-0.02 + (i % 4) * 0.012, -0.04 - Math.floor(i / 4) * 0.02, 0.022]}
        >
          <sphereGeometry args={[0.004, 4, 4]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#44ff44' : '#ff4444'}
            emissive={i % 2 === 0 ? '#44ff44' : '#ff4444'}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
    </group>
  )
}
