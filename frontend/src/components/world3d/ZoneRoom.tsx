import { useState, useRef, useCallback } from 'react'
import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import type { FloorStyle } from '@/contexts/RoomsContext'
import type { WallStyle } from '@/contexts/RoomsContext'

export interface ZoneRoomTheme {
  /** Room accent color (walls, nameplate) */
  color?: string
  /** Floor style */
  floorStyle?: FloorStyle
  /** Wall style */
  wallStyle?: WallStyle
  /** Optional project color tint for the floor */
  projectColor?: string | null
}

interface ZoneRoomProps {
  /** Display name shown on nameplate */
  name: string
  /** Emoji icon for nameplate */
  icon?: string
  /** Room size in world units (default 12) */
  size?: number
  /** Position in world */
  position?: [number, number, number]
  /** Visual theme overrides */
  theme?: ZoneRoomTheme
  /** Children rendered inside the room (machines, props, etc.) */
  children?: React.ReactNode
}

/**
 * Reusable room shell for zone views.
 * Provides the same visual structure as campus Room3D (floor, walls, nameplate)
 * but without requiring a backend Room entity or focus/navigation context.
 *
 * Zones render their own interactive content as children.
 */
export function ZoneRoom({
  name,
  icon,
  size = 12,
  position = [0, 0, 0],
  theme = {},
  children,
}: ZoneRoomProps) {
  const { color = '#7B1FA2', floorStyle = 'default', wallStyle = 'default', projectColor } = theme

  const [hovered, setHovered] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePointerOver = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHovered(true)
  }, [])

  const handlePointerOut = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false)
      hoverTimerRef.current = null
    }, 80)
  }, [])

  return (
    <group position={position} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      {/* Floor — reuses campus RoomFloor component */}
      <RoomFloor
        color={color}
        size={size}
        hovered={hovered}
        projectColor={projectColor}
        floorStyle={floorStyle}
      />

      {/* Walls — reuses campus RoomWalls component */}
      <RoomWalls color={color} size={size} hovered={hovered} wallStyle={wallStyle} />

      {/* Nameplate */}
      <RoomNameplate name={name} icon={icon} color={color} size={size} hovered={hovered} />

      {/* Zone-specific content */}
      {children}
    </group>
  )
}
