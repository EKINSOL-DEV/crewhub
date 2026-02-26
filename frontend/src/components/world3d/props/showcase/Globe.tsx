import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Globe() {
  const globeRef = useRef<THREE.Mesh>(null)
  const ringsRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.008
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.y += 0.015
      ringsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.3
    }
  })

  return (
    <group>
      {/* Earth sphere */}
      <mesh ref={globeRef}>
        <icosahedronGeometry args={[0.6, 2]} />
        <meshStandardMaterial color="#2266aa" flatShading />
      </mesh>
      {/* Land masses (simple patches) */}
      {[
        [0.3, 0.4, 0.35],
        [-0.2, 0.3, -0.45],
        [0.4, -0.1, 0.3],
        [-0.35, -0.2, 0.35],
        [0.1, -0.4, -0.35],
        [-0.3, 0.1, 0.45],
      ].map((pos, i) => (
        <mesh key={JSON.stringify(pos)} position={pos as [number, number, number]}>
          <icosahedronGeometry args={[0.15 + (i % 3) * 0.05, 0]} />
          <meshStandardMaterial color="#44aa55" flatShading />
        </mesh>
      ))}
      {/* Orbit rings */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.9, 0.015, 8, 32]} />
          <meshStandardMaterial color="#ffaa33" emissive="#ff8800" emissiveIntensity={0.8} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0.5, 0]}>
          <torusGeometry args={[1.05, 0.01, 8, 32]} />
          <meshStandardMaterial color="#44ddff" emissive="#22aadd" emissiveIntensity={0.8} />
        </mesh>
      </group>
      {/* Satellites */}
      {[0, Math.PI].map((a, _i) => (
        <mesh key={JSON.stringify(a)} position={[Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff4444" emissiveIntensity={2} />
        </mesh>
      ))}
      {/* Pole axis */}
      <mesh>
        <cylinderGeometry args={[0.01, 0.01, 1.5, 4]} />
        <meshStandardMaterial color="#8888aa" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}
