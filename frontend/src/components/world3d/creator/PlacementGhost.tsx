/**
 * PlacementGhost — semi-transparent prop preview that follows the mouse cursor.
 *
 * When a prop is selected in the Prop Browser, this renders a ghost (50% opacity,
 * green tint) on the world floor (y=0) snapped to 0.5-unit grid.
 *
 * Emits the snapped world position via onPositionChange so the parent can
 * use it for the actual placement API call.
 *
 * Must be rendered inside <Canvas> (uses useThree + useFrame).
 */

import { useRef, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPropEntry } from '../grid/PropRegistry'

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const SNAP = 0.5

function snapToGrid(v: number): number {
  return Math.round(v / SNAP) * SNAP
}

interface PlacementGhostProps {
  propId: string
  rotation: number          // degrees, from CreatorModeContext.pendingRotation
  onPositionChange: (pos: { x: number; y: number; z: number } | null) => void
  cellSize?: number
}

export function PlacementGhost({ propId, rotation, onPositionChange, cellSize = 1.0 }: PlacementGhostProps) {
  const { camera, raycaster, size } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const mouseRef = useRef(new THREE.Vector2())
  const intersectPoint = useRef(new THREE.Vector3())
  const lastEmitted = useRef<{ x: number; z: number } | null>(null)

  const entry = useMemo(() => getPropEntry(propId), [propId])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const canvas = e.target as HTMLElement
      const rect = canvas.getBoundingClientRect?.()
      const x = rect ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : (e.clientX / size.width) * 2 - 1
      const y = rect ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : -(e.clientY / size.height) * 2 + 1
      mouseRef.current.set(x, y)
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [size])

  useFrame(() => {
    if (!groupRef.current) return
    raycaster.setFromCamera(mouseRef.current, camera)
    const hit = raycaster.ray.intersectPlane(GROUND_PLANE, intersectPoint.current)
    if (!hit) {
      groupRef.current.visible = false
      if (lastEmitted.current !== null) {
        lastEmitted.current = null
        onPositionChange(null)
      }
      return
    }

    const sx = snapToGrid(intersectPoint.current.x)
    const sz = snapToGrid(intersectPoint.current.z)

    if (!lastEmitted.current || lastEmitted.current.x !== sx || lastEmitted.current.z !== sz) {
      lastEmitted.current = { x: sx, z: sz }
      onPositionChange({ x: sx, y: 0, z: sz })
    }

    groupRef.current.visible = true
    groupRef.current.position.set(sx, entry?.yOffset ?? 0.16, sz)
    groupRef.current.rotation.y = (rotation * Math.PI) / 180
  })

  if (!entry) return null

  const PropComponent = entry.component

  return (
    <group ref={groupRef}>
      {/* Green ghost overlay */}
      <GhostOverlay scale={entry.yOffset ?? 0.16} />
      <PropComponent
        position={[0, 0, 0]}
        rotation={rotation}
        cellSize={cellSize}
      />
    </group>
  )
}

/** A subtle green ambient glow below the ghost prop */
function GhostOverlay({ scale }: { scale: number }) {
  void scale
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.6, 16]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.25} />
    </mesh>
  )
}
