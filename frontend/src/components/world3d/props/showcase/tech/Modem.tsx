import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Modem() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[0.2, 0.35, 0.06]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      {['#44ff44', '#44ff44', '#ffcc44', '#4488ff', '#44ff44'].map((c, i) => (
        <mesh key={`c-${i}`} position={[0, 0.1 - i * 0.05, 0.032]}>
          <sphereGeometry args={[0.006, 4, 4]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1} />
        </mesh>
      ))}
    </group>
  )
}
