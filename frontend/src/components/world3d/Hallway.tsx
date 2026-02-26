import { useMemo } from 'react'
import { Plant } from './props/Plant'
import { getToonMaterialProps } from './utils/toonMaterials'

interface HallwayProps {
  readonly roomPositions: {
    room?: { is_hq?: boolean }
    position: [number, number, number]
    size?: number
  }[]
  readonly roomSize: number
  readonly hallwayWidth: number
  readonly cols: number
  readonly rows: number
  readonly gridOriginX: number
  readonly gridOriginZ: number
}

/**
 * Grid hallway paths connecting HQ (center) to adjacent rooms via
 * horizontal and vertical corridor strips.
 */
export function Hallway({ roomPositions, hallwayWidth }: HallwayProps) {
  const floorToon = getToonMaterialProps('#C8BFA0')

  const hq = roomPositions.find((rp) => rp.room?.is_hq)
  const center = hq || roomPositions[0]
  const peripherals = roomPositions.filter((rp) => rp !== center)

  const paths = useMemo(() => {
    if (!center || peripherals.length === 0) return []

    return peripherals.map((rp, i) => {
      const cx = center.position[0]
      const cz = center.position[2]
      const rx = rp.position[0]
      const rz = rp.position[2]

      const mx = (cx + rx) / 2
      const mz = (cz + rz) / 2

      const dx = rx - cx
      const dz = rz - cz
      const length = Math.hypot(dx, dz)
      const angle = Math.atan2(dx, dz)

      return { key: `path-${i}`, mx, mz, length, angle }
    })
  }, [center, peripherals])

  const plants = useMemo(() => {
    if (!center) return []
    const items: { position: [number, number, number]; scale: number }[] = []

    for (const rp of peripherals) {
      const mx = (center.position[0] + rp.position[0]) / 2
      const mz = (center.position[2] + rp.position[2]) / 2
      const dx = rp.position[0] - center.position[0]
      const dz = rp.position[2] - center.position[2]
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz / len
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
      {paths.map(({ key, mx, mz, length, angle }) => (
        <mesh key={key} position={[mx, 0.06, mz]} rotation={[-Math.PI / 2, 0, angle]} receiveShadow>
          <planeGeometry args={[hallwayWidth, length]} />
          <meshToonMaterial {...floorToon} />
        </mesh>
      ))}
      {plants.map((p, i) => (
        <Plant key={`hallway-plant-${i}`} position={p.position} scale={p.scale} />
      ))}
    </group>
  )
}
