import { RoomFloor } from './RoomFloor'
import { RoomWalls } from './RoomWalls'
import { RoomNameplate } from './RoomNameplate'
import { Desk } from './props/Desk'
import { Monitor } from './props/Monitor'
import { Chair } from './props/Chair'
import { Lamp } from './props/Lamp'
import type { Room } from '@/hooks/useRooms'

interface Room3DProps {
  room: Room
  position?: [number, number, number]
  size?: number
}

/**
 * Composes a complete 3D room: floor, walls, nameplate, and furniture props.
 * Room size defaults to ~12x12 units.
 */
export function Room3D({ room, position = [0, 0, 0], size = 12 }: Room3DProps) {
  const roomColor = room.color || '#4f46e5'
  const halfSize = size / 2

  return (
    <group position={position}>
      {/* Floor tiles */}
      <RoomFloor color={roomColor} size={size} />

      {/* Perimeter walls */}
      <RoomWalls color={roomColor} size={size} />

      {/* Floating nameplate above entrance */}
      <RoomNameplate
        name={room.name}
        icon={room.icon}
        color={roomColor}
        size={size}
      />

      {/* ─── Furniture props ─────────────────────────── */}
      
      {/* Desk with monitor — back-left area */}
      <Desk
        position={[-halfSize + 2.5, 0, halfSize - 2.5]}
        rotation={[0, Math.PI / 4, 0]}
      />
      <Monitor
        position={[-halfSize + 2.5, 0.78, halfSize - 2.5]}
        rotation={[0, Math.PI / 4, 0]}
      />

      {/* Chair in front of desk */}
      <Chair
        position={[-halfSize + 3.5, 0, halfSize - 3.5]}
        rotation={[0, Math.PI + Math.PI / 4, 0]}
      />

      {/* Second desk + monitor — right area */}
      <Desk
        position={[halfSize - 3, 0, halfSize - 2]}
        rotation={[0, -Math.PI / 6, 0]}
      />
      <Monitor
        position={[halfSize - 3, 0.78, halfSize - 2]}
        rotation={[0, -Math.PI / 6, 0]}
      />

      {/* Chair for second desk */}
      <Chair
        position={[halfSize - 2.2, 0, halfSize - 3]}
        rotation={[0, Math.PI - Math.PI / 6, 0]}
      />

      {/* Lamp — near back wall */}
      <Lamp
        position={[0, 0, halfSize - 1.5]}
        lightColor="#FFD700"
        lightIntensity={0.4}
      />

      {/* Second lamp — front corner */}
      <Lamp
        position={[halfSize - 1.5, 0, -halfSize + 2]}
        lightColor="#FFA500"
        lightIntensity={0.3}
      />
    </group>
  )
}
