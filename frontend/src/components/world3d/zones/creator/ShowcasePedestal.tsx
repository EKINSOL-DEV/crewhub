/**
 * ShowcasePedestal — golden glowing pedestal in the Creator room
 * that opens the fullscreen PropCreator Design Showcase.
 */

import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import { FullscreenShowcase } from './FullscreenShowcase'
import * as THREE from 'three'

interface ShowcasePedestalProps {
  position?: [number, number, number]
}

export function ShowcasePedestal({ position = [0, 0, 0] }: ShowcasePedestalProps) {
  const [hovered, setHovered] = useState(false)
  const [showShowcase, setShowShowcase] = useState(false)
  const coreRef = useRef<THREE.Mesh>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.6
      coreRef.current.position.y = 1.1 + Math.sin(t * 1.2) * 0.06
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.8
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = t * 0.5
      ring2Ref.current.rotation.z = t * -0.3
    }
  })

  return (
    <group
      position={position}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowShowcase(true)
      }}
    >
      {/* Base pedestal */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.3, 6]} />
        <meshStandardMaterial color="#2a1a0a" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Gold rim */}
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.025, 8, 24]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={hovered ? 3 : 1.5}
          metalness={0.8}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Pillar */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 0.6, 6]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Floating golden star/dodecahedron */}
      <mesh ref={coreRef} position={[0, 1.1, 0]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffaa00"
          emissiveIntensity={hovered ? 4 : 2}
          metalness={0.9}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting ring 1 */}
      <mesh ref={ring1Ref} position={[0, 1.1, 0]} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.35, 0.012, 8, 32]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={hovered ? 2.5 : 1}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting ring 2 */}
      <mesh ref={ring2Ref} position={[0, 1.1, 0]} rotation={[Math.PI / 6, Math.PI / 4, 0]}>
        <torusGeometry args={[0.42, 0.008, 8, 32]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ffcc00"
          emissiveIntensity={hovered ? 2 : 0.8}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* "SHOWCASE" text */}
      <Text
        position={[0, 1.55, 0]}
        fontSize={0.12}
        color="#ffd700"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        SHOWCASE
      </Text>

      {/* Glow light */}
      <pointLight
        position={[0, 1.2, 0]}
        color="#ffd700"
        intensity={hovered ? 4 : 1.5}
        distance={5}
        decay={2}
      />

      {/* Spotlight from above */}
      <spotLight
        position={[0, 3, 0]}
        target-position={[0, 0, 0]}
        color="#ffd700"
        intensity={hovered ? 2 : 0.5}
        angle={0.4}
        penumbra={0.5}
        distance={6}
      />

      {/* Tooltip */}
      {hovered && !showShowcase && (
        <Html position={[0, 1.8, 0]} center>
          <div
            style={{
              background: 'rgba(0,0,0,0.85)',
              color: '#ffd700',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              border: '1px solid rgba(255, 215, 0, 0.3)',
            }}
          >
            🎨 PropCreator Design Showcase
          </div>
        </Html>
      )}

      {/* Fullscreen Showcase */}
      {showShowcase && (
        <Html>
          <FullscreenShowcase onClose={() => setShowShowcase(false)} />
        </Html>
      )}
    </group>
  )
}
