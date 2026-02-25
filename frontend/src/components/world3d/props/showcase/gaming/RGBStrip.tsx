import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function RGBStrip() {
  const groupRef = useRef<THREE.Group>(null)
  const ledsRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.12
    if (ledsRef.current)
      ledsRef.current.children.forEach((led, i) => {
        const hue = (s.clock.elapsedTime * 0.5 + i * 0.05) % 1
        const color = new THREE.Color().setHSL(hue, 1, 0.5)
        const mat = (led as THREE.Mesh).material as THREE.MeshStandardMaterial
        mat.color.copy(color)
        mat.emissive.copy(color)
      })
  })
  return (
    <group ref={groupRef}>
      {/* Strip backing */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.04, 0.06]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* LEDs */}
      <group ref={ledsRef}>
        {Array.from({ length: 20 }, (_, i) => (
          <mesh key={`item-${i}`} position={[-0.55 + i * 0.058, 0.025, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.04]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
          </mesh>
        ))}
      </group>
      {/* Controller box */}
      <mesh position={[0.7, 0, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.06]} />
        <meshStandardMaterial color="#333344" />
      </mesh>
      {/* Remote */}
      <mesh position={[0.3, -0.3, 0.15]}>
        <boxGeometry args={[0.12, 0.03, 0.2]} />
        <meshStandardMaterial color="#111122" flatShading />
      </mesh>
      {/* Remote buttons */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`item-${i}`} position={[0.27 + (i % 2) * 0.06, -0.28, 0.08 + Math.floor(i / 2) * 0.06]}>
          <cylinderGeometry args={[0.015, 0.015, 0.01, 6]} />
          <meshStandardMaterial color={['#ff0000', '#00ff00', '#0000ff', '#ffffff'][i]} />
        </mesh>
      ))}
    </group>
  )
}
