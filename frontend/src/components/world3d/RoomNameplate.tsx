import { Text } from '@react-three/drei'
import { Float } from '@react-three/drei'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomNameplateProps {
  name: string
  icon?: string | null
  color?: string
  size?: number  // room size to position above entrance
}

/**
 * Floating nameplate sign above the room entrance.
 * Displays room name + icon emoji with a slight Float animation.
 */
export function RoomNameplate({ name, icon, color, size = 12 }: RoomNameplateProps) {
  const accentColor = color || '#4f46e5'
  const accentToon = useToonMaterialProps(accentColor)
  const halfSize = size / 2
  const displayText = `${icon || '🏠'} ${name}`

  return (
    <Float
      speed={2}
      rotationIntensity={0}
      floatIntensity={0.3}
    >
      <group position={[0, 2.4, -halfSize + 0.2]}>
        {/* Sign backing board */}
        <mesh castShadow>
          <boxGeometry args={[3.2, 0.7, 0.12]} />
          <meshToonMaterial {...accentToon} />
        </mesh>

        {/* Sign face (slightly lighter) */}
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[2.9, 0.5, 0.01]} />
          <meshToonMaterial color="#FFF8F0" gradientMap={accentToon.gradientMap} />
        </mesh>

        {/* Text */}
        <Text
          position={[0, 0, 0.08]}
          fontSize={0.28}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={2.6}
        >
          {displayText}
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
