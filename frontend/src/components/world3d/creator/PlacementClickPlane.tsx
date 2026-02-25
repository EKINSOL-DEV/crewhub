/**
 * PlacementClickPlane — invisible ground plane that captures clicks for prop placement.
 *
 * When Creator Mode is active and a prop is selected, clicking on the 3D world
 * floor triggers prop placement at the snapped grid position.
 *
 * Must be rendered inside <Canvas>.
 *
 * Note: relies on R3F's built-in onClick drag filtering (onClick only fires when
 * there is no significant pointer movement between pointerdown and pointerup).
 * Manual drag tracking was removed as it broke with CameraControls emitting
 * pointermove events during orbit/pan, causing every click to be treated as a drag.
 */

import { useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const SNAP = 0.5

function snapToGrid(v: number): number {
  return Math.round(v / SNAP) * SNAP
}

interface PlacementClickPlaneProps {
  readonly enabled: boolean
  readonly onPlace: (position: { x: number; y: number; z: number }) => void
}

export function PlacementClickPlane({ enabled, onPlace }: PlacementClickPlaneProps) {
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!enabled) return
      e.stopPropagation()
      const point = e.point as THREE.Vector3
      onPlace({ x: snapToGrid(point.x), y: 0, z: snapToGrid(point.z) })
    },
    [enabled, onPlace]
  )

  if (!enabled) return null

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onClick={handleClick}
      renderOrder={0}
    >
      {/* Large plane covering the whole world */}
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
