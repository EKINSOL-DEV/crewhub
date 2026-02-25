import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WiFiExtender() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.12, 0.2, 0.04]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={1.5} />
      </mesh>
      {[1, 2, 3].map((i) => (
        <mesh key={`item-${i}`} position={[0, 0.05, 0.025]}>
          <torusGeometry args={[i * 0.03, 0.003, 4, 8, Math.PI]} />
          <meshStandardMaterial color="#44aaff" transparent opacity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.03]} />
        <meshStandardMaterial color="#ddddee" flatShading />
      </mesh>
    </group>
  )
}
