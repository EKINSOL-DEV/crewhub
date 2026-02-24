/**
 * PlacedPropsRenderer — renders all placed props from the backend in the 3D world.
 *
 * Uses the same prop factory (PropRegistry) as the room grid renderer so props
 * look identical whether placed via Creator Mode or hardcoded in a blueprint.
 *
 * This component must be rendered INSIDE the R3F <Canvas>.
 */

import { useMemo } from 'react'
import { getPropEntry } from '../grid/PropRegistry'
import type { PlacedProp } from '@/contexts/CreatorModeContext'

interface PlacedPropsRendererProps {
  placedProps: PlacedProp[]
  /** Cell size passed to each prop component (default 1.0 — world-coordinate props) */
  cellSize?: number
}

export function PlacedPropsRenderer({ placedProps, cellSize = 1.0 }: PlacedPropsRendererProps) {
  return (
    <>
      {placedProps.map(placed => (
        <PlacedPropMesh key={placed.id} placed={placed} cellSize={cellSize} />
      ))}
    </>
  )
}

function PlacedPropMesh({ placed, cellSize }: { placed: PlacedProp; cellSize: number }) {
  const entry = useMemo(() => getPropEntry(placed.prop_id), [placed.prop_id])

  if (!entry) return null

  const PropComponent = entry.component
  const yOffset = entry.yOffset ?? 0.16
  const rotationDeg = placed.rotation_y ?? 0
  const scale = placed.scale ?? 1.0

  return (
    <group
      position={[placed.position.x, placed.position.y + yOffset, placed.position.z]}
      rotation={[0, (rotationDeg * Math.PI) / 180, 0]}
      scale={[scale, scale, scale]}
    >
      <PropComponent
        position={[0, 0, 0]}
        rotation={0}
        cellSize={cellSize}
      />
    </group>
  )
}
