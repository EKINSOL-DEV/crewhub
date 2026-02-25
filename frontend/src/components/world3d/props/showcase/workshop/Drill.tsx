import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Drill() {
  const bitRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15
    if (bitRef.current) bitRef.current.rotation.y += 0.15
  })
  return (
    <group ref={groupRef} rotation={[0, 0, -0.4]}>
      {/* Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.2, 0.35, 0.18]} />
        <meshStandardMaterial color="#22aa44" flatShading />
      </mesh>
      {/* Motor housing */}
      <mesh position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.09, 0.15, 8]} />
        <meshStandardMaterial color="#22aa44" flatShading />
      </mesh>
      {/* Chuck */}
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.08, 8]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Drill bit */}
      <mesh ref={bitRef} position={[0, 0.5, 0]}>
        <coneGeometry args={[0.02, 0.3, 6]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Handle/grip */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 0.2, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Trigger */}
      <mesh position={[0.05, -0.05, 0.1]}>
        <boxGeometry args={[0.03, 0.08, 0.04]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {/* Battery pack */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.15, 0.1, 0.12]} />
        <meshStandardMaterial color="#1a1a2a" flatShading />
      </mesh>
      {/* LED */}
      <mesh position={[0, 0.25, 0.08]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
