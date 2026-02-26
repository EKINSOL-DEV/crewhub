import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function SafetyGoggles() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.2
  })
  return (
    <group ref={groupRef}>
      {/* Frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.22, 0.15]} />
        <meshStandardMaterial color="#ddddee" transparent opacity={0.3} flatShading />
      </mesh>
      {/* Left lens */}
      <mesh position={[-0.15, 0, 0.08]}>
        <boxGeometry args={[0.2, 0.18, 0.01]} />
        <meshStandardMaterial color="#aaccff" transparent opacity={0.2} />
      </mesh>
      {/* Right lens */}
      <mesh position={[0.15, 0, 0.08]}>
        <boxGeometry args={[0.2, 0.18, 0.01]} />
        <meshStandardMaterial color="#aaccff" transparent opacity={0.2} />
      </mesh>
      {/* Bridge */}
      <mesh position={[0, 0, 0.08]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#ccccdd" />
      </mesh>
      {/* Frame top */}
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[0.58, 0.03, 0.12]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      {/* Frame bottom */}
      <mesh position={[0, -0.1, 0.02]}>
        <boxGeometry args={[0.58, 0.03, 0.12]} />
        <meshStandardMaterial color="#4488ff" flatShading />
      </mesh>
      {/* Strap */}
      <mesh position={[0, 0.02, -0.12]}>
        <boxGeometry args={[0.7, 0.06, 0.02]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>
      {/* Vents */}
      {[-0.28, 0.28].map((x) => (
        <group key={x}>
          {[0, 1, 2].map((j) => (
            <mesh key={j} position={[x, -0.02 + j * 0.04, 0.08]}>
              <boxGeometry args={[0.02, 0.02, 0.01]} />
              <meshStandardMaterial color="#888899" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
