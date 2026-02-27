import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function VRHeadset() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Main body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.4, 0.35]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {/* Front face (curved) */}
      <mesh position={[0, 0, 0.18]}>
        <boxGeometry args={[0.72, 0.42, 0.02]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* Lenses */}
      {[-0.15, 0.15].map((x) => (
        <group key={x}>
          <mesh position={[x, 0, -0.15]}>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 8]} />
            <meshStandardMaterial color="#334455" transparent opacity={0.5} />
          </mesh>
          <mesh position={[x, 0, -0.17]}>
            <ringGeometry args={[0.08, 0.1, 8]} />
            <meshStandardMaterial color="#444466" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Face cushion */}
      <mesh position={[0, 0, -0.18]}>
        <boxGeometry args={[0.65, 0.35, 0.04]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      {/* Head strap */}
      <mesh position={[0, 0.21, -0.05]}>
        <boxGeometry args={[0.68, 0.04, 0.4]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Side strap */}
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} position={[x, 0, -0.1]}>
          <boxGeometry args={[0.02, 0.15, 0.3]} />
          <meshStandardMaterial color="#333344" />
        </mesh>
      ))}
      {/* LED strip */}
      <mesh position={[0, -0.21, 0.18]}>
        <boxGeometry args={[0.4, 0.01, 0.01]} />
        <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={2} />
      </mesh>
      {/* Cameras */}
      {[
        [-0.3, 0.1],
        [0.3, 0.1],
        [-0.3, -0.1],
        [0.3, -0.1],
      ].map(([x, y]) => (
        <mesh key={`cam-${x}-${y}`} position={[x, y, 0.19]}>
          <cylinderGeometry args={[0.02, 0.02, 0.01, 6]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
    </group>
  )
}
