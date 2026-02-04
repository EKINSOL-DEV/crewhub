import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
  hovered?: boolean
}

/**
 * Room floor — thin colored overlay sitting on top of the building floor.
 * Just provides the room-specific color; the building floor is underneath.
 *
 * On hover: emissive glow using the room color (intensity 0.15).
 */
export function RoomFloor({ color, size = 12, hovered = false }: RoomFloorProps) {
  const baseColor = color || '#9E9684'
  const toonProps = useToonMaterialProps(baseColor)
  const matRef = useRef<THREE.MeshToonMaterial>(null)

  // Smooth emissive transition
  useFrame(() => {
    if (!matRef.current) return
    const target = hovered ? 0.15 : 0
    const current = matRef.current.emissiveIntensity
    matRef.current.emissiveIntensity += (target - current) * 0.15
    if (hovered) {
      matRef.current.emissive.set(baseColor)
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
        emissive="#000000"
        emissiveIntensity={0}
      />
    </mesh>
  )
}
