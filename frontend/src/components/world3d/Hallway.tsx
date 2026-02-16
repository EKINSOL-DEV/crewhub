import { useMemo } from 'react'
import { Plant } from './props/Plant'
import { useToonMaterialProps } from './utils/toonMaterials'

interface HallwayProps {
  roomPositions: { room?: { is_hq?: boolean }; position: [number, number, number]; size?: number }[]
  roomSize: number
  hallwayWidth: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

/**
 * Radial hallway paths connecting HQ (center) to peripheral rooms.
 * Renders floor strips + decorative plants along paths.
 */
export function Hallway({ roomPositions, hallwayWidth }: HallwayProps) {
  const floorToon = useToonMaterialProps('#C8BFA0')

  // Find HQ (center room) and peripheral rooms
  const hq = roomPositions.find(rp => rp.room?.is_hq)
  const center = hq || roomPositions[0]
  const peripherals = roomPositions.filter(rp => rp !== center)

  const paths = useMemo(() => {
    if (!center || peripherals.length === 0) return []

    return peripherals.map((rp, i) => {
      const cx = center.position[0]
      const cz = center.position[2]
      const rx = rp.position[0]
      const rz = rp.position[2]

      // Midpoint
      const mx = (cx + rx) / 2
      const mz = (cz + rz) / 2

      // Length and angle
      const dx = rx - cx
      const dz = rz - cz
      const length = Math.sqrt(dx * dx + dz * dz)
      const angle = Math.atan2(dx, dz)

      return { key: `path-${i}`, mx, mz, length, angle }
    })
  }, [center, peripherals])

  const plants = useMemo(() => {
    if (!center) return []
    const items: { position: [number, number, number]; scale: number }[] = []

    // Plants at midpoints of paths
    for (const rp of peripherals) {
      const mx = (center.position[0] + rp.position[0]) / 2
      const mz = (center.position[2] + rp.position[2]) / 2
      // Offset slightly to the side
      const dx = rp.position[0] - center.position[0]
      const dz = rp.position[2] - center.position[2]
      const len = Math.sqrt(dx * dx + dz * dz) || 1
      const nx = -dz / len // perpendicular
      const nz = dx / len
      items.push({
        position: [mx + nx * 1.5, 0.16, mz + nz * 1.5],
        scale: 0.7,
      })
    }

    return items
  }, [center, peripherals])

  return (
    <group>
      {/* Floor paths from HQ to each room */}
      {paths.map(({ key, mx, mz, length, angle }) => (
        <mesh
          key={key}
          position={[mx, 0.06, mz]}
          rotation={[-Math.PI / 2, 0, angle]}
          receiveShadow
        >
          <planeGeometry args={[hallwayWidth, length]} />
          <meshToonMaterial {...floorToon} />
        </mesh>
      ))}

      {/* Decorative plants along paths */}
      {plants.map((p, i) => (
        <Plant key={`plant-${i}`} position={p.position} scale={p.scale} />
      ))}
    </group>
  )
}
