import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Beaker() {
  const groupRef = useRef<THREE.Group>(null)
  const bubbleRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15
    if (bubbleRef.current)
      bubbleRef.current.children.forEach((b, i) => {
        b.position.y = -0.1 + ((s.clock.elapsedTime * 0.3 + i * 0.3) % 0.5)
      })
  })
  return (
    <group ref={groupRef}>
      {/* Glass body */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.25, 0.22, 0.6, 8]} />
        <meshStandardMaterial
          color="#ccddee"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
      {/* Spout */}
      <mesh position={[0.15, 0.15, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.04, 0.06]} />
        <meshStandardMaterial color="#ccddee" transparent opacity={0.2} />
      </mesh>
      {/* Liquid */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.4, 8]} />
        <meshStandardMaterial color="#44ddaa" transparent opacity={0.4} />
      </mesh>
      {/* Graduation marks */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`item-${i}`} position={[0.22, -0.35 + i * 0.12, 0]}>
          <boxGeometry args={[0.03, 0.005, 0.001]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* Bubbles */}
      <group ref={bubbleRef}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={`item-${i}`}
            position={[(Math.random() - 0.5) * 0.15, -0.1 + i * 0.08, (Math.random() - 0.5) * 0.15]}
          >
            <sphereGeometry args={[0.012 + Math.random() * 0.01, 4, 4]} />
            <meshStandardMaterial color="#88ffcc" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
