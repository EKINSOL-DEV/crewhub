import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MicroscopeSlides() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.005, -0.24 + i * 0.005, 0]}>
          <boxGeometry args={[0.08, 0.003, 0.25]} />
          <meshStandardMaterial color="#ccddee" transparent opacity={0.3} flatShading />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.005, -0.235 + i * 0.005, 0.05]}>
          <boxGeometry args={[0.02, 0.002, 0.02]} />
          <meshStandardMaterial color="#ccddee" transparent opacity={0.2} />
        </mesh>
      ))}
      <mesh position={[0.005, -0.233, 0.05]}>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial color="#ff88aa" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}
