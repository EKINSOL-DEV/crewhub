import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Multimeter() {
  const groupRef = useRef<THREE.Group>(null)
  const dialRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1
    if (dialRef.current) dialRef.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.8) * 0.5
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.18, 0.3, 0.04]} />
        <meshStandardMaterial color="#ffcc22" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0.022]}>
        <boxGeometry args={[0.12, 0.06, 0.002]} />
        <meshStandardMaterial color="#88ccaa" emissive="#88ccaa" emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={dialRef} position={[0, -0.04, 0.022]}>
        <cylinderGeometry args={[0.03, 0.03, 0.005, 12]} />
        <meshStandardMaterial color="#333344" flatShading />
      </mesh>
      {[-0.04, 0, 0.04].map((x, i) => (
        <mesh key={i} position={[x, -0.15, 0.022]}>
          <cylinderGeometry args={[0.01, 0.01, 0.005, 6]} />
          <meshStandardMaterial color={['#ff4444', '#222222', '#222222'][i]} flatShading />
        </mesh>
      ))}
    </group>
  )
}
