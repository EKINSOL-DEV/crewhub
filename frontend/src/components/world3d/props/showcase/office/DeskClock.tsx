import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DeskClock() {
  const handRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.1
    if (handRef.current) handRef.current.rotation.z = -s.clock.elapsedTime * 0.5
  })
  return (
    <group ref={groupRef}>
      {/* Clock face */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 16]} />
        <meshStandardMaterial color="#eeeeee" flatShading />
      </mesh>
      {/* Rim */}
      <mesh position={[0, -0.1, 0]}>
        <torusGeometry args={[0.4, 0.03, 8, 16]} />
        <meshStandardMaterial color="#cc8833" />
      </mesh>
      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 0.32, -0.1 + Math.cos(a) * 0.32, 0.05]}>
            <boxGeometry args={[0.02, 0.06, 0.01]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        )
      })}
      {/* Hour hand */}
      <mesh position={[0, 0, 0.05]} rotation={[0, 0, -0.8]}>
        <boxGeometry args={[0.02, 0.2, 0.01]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Minute hand */}
      <mesh ref={handRef} position={[0, -0.1, 0.05]}>
        <boxGeometry args={[0.015, 0.28, 0.01]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Center dot */}
      <mesh position={[0, -0.1, 0.05]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>
      {/* Stand */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[0.25, 0.06, 0.15]} />
        <meshStandardMaterial color="#cc8833" flatShading />
      </mesh>
    </group>
  )
}
