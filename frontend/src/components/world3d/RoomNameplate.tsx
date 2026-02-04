import { useRef } from 'react'
import { Text, Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomNameplateProps {
  name: string
  icon?: string | null
  color?: string
  size?: number  // room size to position above entrance
  hovered?: boolean
}

/**
 * Floating nameplate sign above the room entrance.
 * Displays room name on both sides of the sign with 3D text and a slight Float animation.
 *
 * On hover: scales to 1.04 with a smooth tween.
 */
export function RoomNameplate({ name, icon: _icon, color, size = 12, hovered = false }: RoomNameplateProps) {
  const accentColor = color || '#4f46e5'
  const accentToon = useToonMaterialProps(accentColor)
  const halfSize = size / 2
  const groupRef = useRef<THREE.Group>(null)

  // Smooth scale tween on hover
  useFrame(() => {
    if (!groupRef.current) return
    const target = hovered ? 1.04 : 1.0
    const current = groupRef.current.scale.x
    const next = current + (target - current) * 0.12
    groupRef.current.scale.setScalar(next)
  })

  return (
    <Float
      speed={2}
      rotationIntensity={0}
      floatIntensity={0.3}
    >
      <group ref={groupRef} position={[0, 2.4, -halfSize + 0.2]}>
        {/* Sign backing board */}
        <mesh castShadow>
          <boxGeometry args={[3.2, 0.7, 0.12]} />
          <meshToonMaterial {...accentToon} />
        </mesh>

        {/* Front face (slightly lighter) */}
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[2.9, 0.5, 0.01]} />
          <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
        </mesh>

        {/* Back face (slightly lighter) */}
        <mesh position={[0, 0, -0.065]}>
          <boxGeometry args={[2.9, 0.5, 0.01]} />
          <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
        </mesh>

        {/* Front text (3D) */}
        <Text
          position={[0, 0, 0.08]}
          fontSize={0.28}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.6}
        >
          {name}
        </Text>

        {/* Back text (3D, rotated to face backward) */}
        <Text
          position={[0, 0, -0.08]}
          rotation={[0, Math.PI, 0]}
          fontSize={0.28}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.6}
        >
          {name}
        </Text>

        {/* Support poles */}
        <mesh position={[-1.2, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
        <mesh position={[1.2, -0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
          <meshToonMaterial {...accentToon} />
        </mesh>
      </group>
    </Float>
  )
}
