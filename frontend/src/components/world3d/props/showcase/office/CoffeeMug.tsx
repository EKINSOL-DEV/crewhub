import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CoffeeMug() {
  const groupRef = useRef<THREE.Group>(null)
  const steamParts = useMemo(
    () =>
      Array.from({ length: 8 }, () => ({
        x: (Math.random() - 0.5) * 0.1,
        z: (Math.random() - 0.5) * 0.1,
        offset: Math.random() * 6,
      })),
    []
  )
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Mug body */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {/* Coffee */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 8]} />
        <meshStandardMaterial color="#3a1a0a" />
      </mesh>
      {/* Handle */}
      <mesh position={[0.3, -0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.03, 6, 8, Math.PI]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {/* Heart logo */}
      <mesh position={[0, -0.1, 0.21]}>
        <sphereGeometry args={[0.05, 4, 4]} />
        <meshStandardMaterial color="#ff4466" flatShading />
      </mesh>
      {/* Steam */}
      {steamParts.map((p, i) => (
        <mesh key={i} position={[p.x, 0.15 + i * 0.05, p.z]}>
          <sphereGeometry args={[0.02 + i * 0.003, 4, 4]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.12 - i * 0.012} />
        </mesh>
      ))}
    </group>
  )
}
