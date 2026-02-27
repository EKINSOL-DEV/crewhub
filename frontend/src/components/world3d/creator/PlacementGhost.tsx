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
  readonly propId: string
  readonly rotation: number // degrees, from CreatorModeContext.pendingRotation
  readonly onPositionChange: (pos: { x: number; y: number; z: number } | null) => void
  readonly cellSize?: number
}

export function PlacementGhost({
  propId,
  rotation,
  onPositionChange,
  cellSize = 1,
}: Readonly<PlacementGhostProps>) {
  const { camera, raycaster, gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const mouseRef = useRef(new THREE.Vector2())
  const intersectPoint = useRef(new THREE.Vector3())
  const lastEmitted = useRef<{ x: number; z: number } | null>(null)

  const entry = useMemo(() => getPropEntry(propId), [propId])

  useEffect(() => {
    // M4 fix: use gl.domElement.getBoundingClientRect() so NDC coords are correct
    // when the canvas doesn't fill the full viewport (e.g. side panels open,
    // tabbed view). Using e.clientX / window size was wrong when canvas ≠ viewport.
    const onMouseMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      mouseRef.current.set(x, y)
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [gl]) // gl.domElement is stable

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

    if (lastEmitted.current?.x !== sx || lastEmitted.current?.z !== sz) {
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
      <PropComponent position={[0, 0, 0]} rotation={rotation} cellSize={cellSize} />
    </group>
  )
}

/** A subtle green ambient glow below the ghost prop */
function GhostOverlay({ scale: _scale }: Readonly<{ scale: number }>) {
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.6, 16]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.25} />
    </mesh>
  )
}
