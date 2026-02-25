import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function LabApron() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
      groupRef.current.position.y = Math.sin(s.clock.elapsedTime * 0.8) * 0.02
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.35, 0.5, 0.02]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 0.22, 0.01]}>
        <boxGeometry args={[0.1, 0.04, 0.01]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
      <mesh position={[0, -0.05, 0.015]}>
        <boxGeometry args={[0.15, 0.1, 0.005]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0.15, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.2, 4]} />
          <meshStandardMaterial color="#ddddee" flatShading />
        </mesh>
      ))}
    </group>
  )
}
