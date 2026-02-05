import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useToonMaterialProps } from './utils/toonMaterials'
import {
  createTilesFloorMaterial,
  createWoodFloorMaterial,
  createConcreteFloorMaterial,
  createCarpetFloorMaterial,
  createLabFloorMaterial,
  createMarbleFloorMaterial,
  createLightWoodFloorMaterial,
  createLightTilesFloorMaterial,
  createSandFloorMaterial,
} from './shaders/floorShaders'
import type { FloorStyle } from '@/contexts/RoomsContext'

interface RoomFloorProps {
  color?: string
  size?: number // units (default 12)
  hovered?: boolean
  projectColor?: string | null
  isHQ?: boolean
  floorStyle?: FloorStyle
}

/**
 * Room floor — thin colored overlay sitting on top of the building floor.
 * Supports multiple procedural floor styles (tiles, wood, concrete, carpet, lab).
 *
 * On hover: emissive glow using the room color (intensity 0.15).
 * Project rooms: persistent subtle emissive tint (intensity 0.03) using project color.
 * HQ: gold tint (#FFD700) at intensity 0.05 — always on.
 */
export function RoomFloor({
  color,
  size = 12,
  hovered = false,
  projectColor,
  isHQ = false,
  floorStyle = 'default',
}: RoomFloorProps) {
  const baseColor = color || '#9E9684'

  // ─── Default (toon) material ──────────────────────────────
  const toonProps = useToonMaterialProps(baseColor)
  const toonMatRef = useRef<THREE.MeshToonMaterial>(null)

  // Determine the persistent (non-hover) emissive color and intensity
  const hasProjectTint = isHQ || !!projectColor
  const persistentEmissiveColor = isHQ ? '#FFD700' : (projectColor || '#000000')
  const persistentIntensity = isHQ ? 0.05 : (projectColor ? 0.03 : 0)

  // ─── Shader material for non-default styles ───────────────
  const shaderMat = useMemo(() => {
    switch (floorStyle) {
      case 'tiles':
        return createTilesFloorMaterial(baseColor)
      case 'wood':
        return createWoodFloorMaterial()
      case 'concrete':
        return createConcreteFloorMaterial()
      case 'carpet':
        return createCarpetFloorMaterial(baseColor)
      case 'lab':
        return createLabFloorMaterial()
      case 'marble':
        return createMarbleFloorMaterial()
      case 'light-wood':
        return createLightWoodFloorMaterial()
      case 'light-tiles':
        return createLightTilesFloorMaterial()
      case 'sand':
        return createSandFloorMaterial()
      default:
        return null
    }
  }, [floorStyle, baseColor])

  // Smooth emissive transition (default toon material only)
  useFrame(() => {
    if (floorStyle !== 'default') return
    if (!toonMatRef.current) return

    const targetIntensity = hovered ? 0.15 : persistentIntensity
    const targetColor = hovered ? baseColor : persistentEmissiveColor

    const current = toonMatRef.current.emissiveIntensity
    toonMatRef.current.emissiveIntensity += (targetIntensity - current) * 0.15

    if (hovered || hasProjectTint) {
      toonMatRef.current.emissive.set(targetColor)
    } else if (current < 0.005) {
      toonMatRef.current.emissive.set('#000000')
    }
  })

  const isDefault = floorStyle === 'default'

  return (
    <mesh position={[0, 0.08, 0]} receiveShadow>
      <boxGeometry args={[size, 0.16, size]} />
      {isDefault ? (
        <meshToonMaterial
          ref={toonMatRef}
          {...toonProps}
          emissive={hasProjectTint ? persistentEmissiveColor : '#000000'}
          emissiveIntensity={persistentIntensity}
        />
      ) : (
        <primitive object={shaderMat!} attach="material" />
      )}
    </mesh>
  )
}
