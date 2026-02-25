/**
 * PlacementClickPlane — invisible ground plane that captures clicks for prop placement.
 *
 * When Creator Mode is active and a prop is selected, clicking on the 3D world
 * floor triggers prop placement at the snapped grid position.
 *
 * Must be rendered inside <Canvas>.
 */

import { useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const SNAP = 0.5

function snapToGrid(v: number): number {
  return Math.round(v / SNAP) * SNAP
}

interface PlacementClickPlaneProps {
  enabled: boolean
  onPlace: (position: { x: number; y: number; z: number }) => void
}

export function PlacementClickPlane({ enabled, onPlace }: PlacementClickPlaneProps) {
  const didDrag = useRef(false)
  const mouseDownPos = useRef({ x: 0, y: 0 })
  const { size } = useThree()
  void size

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    mouseDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
    didDrag.current = false
  }, [])

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const dx = e.nativeEvent.clientX - mouseDownPos.current.x
    const dy = e.nativeEvent.clientY - mouseDownPos.current.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      didDrag.current = true
    }
  }, [])

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!enabled) return
      if (didDrag.current) return

      // Prevent the event from bubbling to room-click handlers
      e.stopPropagation()

      const point = e.point as THREE.Vector3
      const sx = snapToGrid(point.x)
      const sz = snapToGrid(point.z)

      onPlace({ x: sx, y: 0, z: sz })
    },
    [enabled, onPlace]
  )

  if (!enabled) return null

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      renderOrder={0}
    >
      {/* Large plane covering the whole world */}
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
