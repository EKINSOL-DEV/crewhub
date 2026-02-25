import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function ArcadeStick() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15
  })
  return (
    <group ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.8, 0.1, 0.45]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      {/* Top panel */}
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[0.78, 0.02, 0.43]} />
        <meshStandardMaterial color="#222244" flatShading />
      </mesh>
      {/* Joystick base */}
      <mesh position={[-0.2, -0.22, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 8]} />
        <meshStandardMaterial color="#333355" />
      </mesh>
      {/* Joystick shaft */}
      <mesh position={[-0.2, -0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 6]} />
        <meshStandardMaterial color="#888899" />
      </mesh>
      {/* Joystick ball */}
      <mesh position={[-0.2, 0.02, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#ff2244" flatShading />
      </mesh>
      {/* Buttons - 2 rows of 4 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`t-${i}`} position={[0.05 + i * 0.1, -0.21, -0.05]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
          <meshStandardMaterial
            color={['#ff4444', '#ffcc44', '#44ff44', '#4488ff'][i]}
            emissive={['#ff4444', '#ffcc44', '#44ff44', '#4488ff'][i]}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`b-${i}`} position={[0.1 + i * 0.1, -0.21, 0.08]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
          <meshStandardMaterial
            color={['#ff8844', '#88ff44', '#4488ff', '#aa44ff'][i]}
            emissive={['#ff8844', '#88ff44', '#4488ff', '#aa44ff'][i]}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
      {/* USB cable */}
      <mesh position={[0, -0.3, -0.26]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 4]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  )
}
