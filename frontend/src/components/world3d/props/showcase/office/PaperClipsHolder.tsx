import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PaperClipsHolder() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.1, 8]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#aaaacc" emissive="#444466" emissiveIntensity={0.3} />
      </mesh>
      {[...new Array(8)].map((_, i) => (
        <mesh
          key={`item-${i}`}
          position={[Math.cos(i * 0.8) * 0.05, -0.12 + i * 0.01, Math.sin(i * 0.8) * 0.05]}
          rotation={[0.3 * i, 0.5 * i, 0]}
        >
          <torusGeometry args={[0.02, 0.003, 3, 6]} />
          <meshStandardMaterial
            color={
              [
                '#ff4444',
                '#44ff44',
                '#4444ff',
                '#ffff44',
                '#ff44ff',
                '#44ffff',
                '#ff8844',
                '#88ff44',
              ][i]
            }
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
