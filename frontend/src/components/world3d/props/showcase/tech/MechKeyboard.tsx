import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MechKeyboard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3) * 0.15
  })
  const rgbColors = [
    '#ff0044',
    '#ff8800',
    '#ffff00',
    '#00ff44',
    '#0088ff',
    '#8800ff',
    '#ff00aa',
    '#00ffff',
    '#ff4400',
    '#44ff88',
  ]
  return (
    <group ref={groupRef}>
      {/* Case */}
      <mesh position={[0, -0.38, 0]}>
        <boxGeometry args={[1.1, 0.1, 0.45]} />
        <meshStandardMaterial color="#1a1a1a" flatShading />
      </mesh>
      {/* Plate */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[1.05, 0.02, 0.42]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* Keycaps with RGB */}
      {[0, 1, 2, 3].map((row) =>
        Array.from({ length: 10 }, (_, col) => (
          <group key={`${row}-${col}`}>
            <mesh position={[-0.45 + col * 0.1, -0.28, 0.14 - row * 0.09]}>
              <boxGeometry args={[0.08, 0.06, 0.07]} />
              <meshStandardMaterial color="#333333" flatShading />
            </mesh>
            {/* RGB underglow */}
            <mesh position={[-0.45 + col * 0.1, -0.33, 0.14 - row * 0.09]}>
              <boxGeometry args={[0.09, 0.005, 0.08]} />
              <meshStandardMaterial
                color={rgbColors[(row + col) % rgbColors.length]}
                emissive={rgbColors[(row + col) % rgbColors.length]}
                emissiveIntensity={2}
              />
            </mesh>
          </group>
        ))
      )}
      {/* USB-C cable */}
      <mesh position={[0, -0.38, -0.26]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Wrist rest */}
      <mesh position={[0, -0.4, 0.35]}>
        <boxGeometry args={[1.1, 0.06, 0.2]} />
        <meshStandardMaterial color="#444444" flatShading />
      </mesh>
    </group>
  )
}
