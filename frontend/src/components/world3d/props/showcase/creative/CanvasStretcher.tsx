import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CanvasStretcher() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.03]} />
        <meshStandardMaterial color="#fffff0" flatShading />
      </mesh>
      <mesh position={[0, 0.3, -0.02]}>
        <boxGeometry args={[0.5, 0.02, 0.02]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      <mesh position={[0, -0.3, -0.02]}>
        <boxGeometry args={[0.5, 0.02, 0.02]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      <mesh position={[-0.25, 0, -0.02]}>
        <boxGeometry args={[0.02, 0.6, 0.02]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
      <mesh position={[0.25, 0, -0.02]}>
        <boxGeometry args={[0.02, 0.6, 0.02]} />
        <meshStandardMaterial color="#aa8844" flatShading />
      </mesh>
    </group>
  )
}
