import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
  hovered?: boolean
  projectColor?: string | null
  isHQ?: boolean
}

/**
 * Room floor — thin colored overlay sitting on top of the building floor.
 * Just provides the room-specific color; the building floor is underneath.
 *
 * On hover: emissive glow using the room color (intensity 0.15).
 * Project rooms: persistent subtle emissive tint (intensity 0.03) using project color.
 * HQ: gold tint (#FFD700) at intensity 0.05 — always on.
 */
export function RoomFloor({ color, size = 12, hovered = false, projectColor, isHQ = false }: RoomFloorProps) {
  const baseColor = color || '#9E9684'
  const toonProps = useToonMaterialProps(baseColor)
  const matRef = useRef<THREE.MeshToonMaterial>(null)

  // Determine the persistent (non-hover) emissive color and intensity
  const hasProjectTint = isHQ || !!projectColor
  const persistentEmissiveColor = isHQ ? '#FFD700' : (projectColor || '#000000')
  const persistentIntensity = isHQ ? 0.05 : (projectColor ? 0.03 : 0)

  // Smooth emissive transition
  useFrame(() => {
    if (!matRef.current) return

    // Hover takes priority over project tint
    const targetIntensity = hovered ? 0.15 : persistentIntensity
    const targetColor = hovered ? baseColor : persistentEmissiveColor

    const current = matRef.current.emissiveIntensity
    matRef.current.emissiveIntensity += (targetIntensity - current) * 0.15

    if (hovered || hasProjectTint) {
      matRef.current.emissive.set(targetColor)
    } else if (current < 0.005) {
      matRef.current.emissive.set('#000000')
    }
  })

  return (
    <mesh position={[0, 0.08, 0]} receiveShadow>
      <boxGeometry args={[size, 0.16, size]} />
      <meshToonMaterial
        ref={matRef}
        {...toonProps}
        emissive={hasProjectTint ? persistentEmissiveColor : '#000000'}
        emissiveIntensity={persistentIntensity}
      />
    </mesh>
  )
}
