// ─── Grid Debug Overlay ─────────────────────────────────────────
// Visual debug overlay that renders the 20×20 grid for a room.
// Color-coded cells: green=walkable, red=blocked, blue=interaction,
// yellow=door. Uses InstancedMesh for performance.

import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { RoomBlueprint } from '@/lib/grid/types'
import { gridToWorld } from '@/lib/grid/blueprintUtils'

// ─── Color palette ──────────────────────────────────────────────

const COLORS = {
  walkable: new THREE.Color(0x22c55e), // green
  blocked: new THREE.Color(0xef4444), // red
  interaction: new THREE.Color(0x3b82f6), // blue
  door: new THREE.Color(0xeab308), // yellow
  gridLine: new THREE.Color(0xffffff), // white
} as const

const OPACITY = {
  walkable: 0.55,
  blocked: 0.7,
  interaction: 0.75,
  door: 0.75,
} as const

// ─── Types ──────────────────────────────────────────────────────

interface CellInstance {
  x: number
  z: number
  worldX: number
  worldZ: number
  color: THREE.Color
  opacity: number
  propId?: string
}

type CellCategory = 'walkable' | 'blocked' | 'interaction' | 'door'

interface GridDebugOverlayProps {
  readonly blueprint: RoomBlueprint
  readonly showLabels?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────

function classifyCell(cell: {
  type: string
  walkable: boolean
  interactionType?: string
}): CellCategory {
  if (cell.type === 'door') return 'door'
  if (cell.type === 'interaction' || cell.interactionType) return 'interaction'
  if (!cell.walkable) return 'blocked'
  return 'walkable'
}

// ─── Instanced cell layer (one per category for shared material) ─

function CellLayer({
  cells,
  cellSize,
  opacity,
  color,
}: Readonly<{
  readonly cells: { worldX: number; worldZ: number }[]
  readonly cellSize: number
  readonly opacity: number
  readonly color: THREE.Color
}>) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const count = cells.length

  useEffect(() => {
    if (!meshRef.current || count === 0) return
    const dummy = new THREE.Object3D()
    const pad = cellSize * 0.92 // slight inset so grid lines show

    for (let i = 0; i < count; i++) {
      const c = cells[i]
      dummy.position.set(c.worldX, 0.12, c.worldZ)
      dummy.rotation.set(-Math.PI / 2, 0, 0) // lay flat on ground
      dummy.scale.set(pad, pad, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [cells, cellSize, count])

  if (count === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

// ─── Grid lines (wireframe grid) ────────────────────────────────

function GridLines({
  gridWidth,
  gridDepth,
  cellSize,
}: Readonly<{
  readonly gridWidth: number
  readonly gridDepth: number
  readonly cellSize: number
}>) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const halfW = (gridWidth * cellSize) / 2
    const halfD = (gridDepth * cellSize) / 2

    // Vertical lines (along Z)
    for (let x = 0; x <= gridWidth; x++) {
      const wx = x * cellSize - halfW
      points.push(new THREE.Vector3(wx, 0.13, -halfD), new THREE.Vector3(wx, 0.13, halfD))
    }
    // Horizontal lines (along X)
    for (let z = 0; z <= gridDepth; z++) {
      const wz = z * cellSize - halfD
      points.push(new THREE.Vector3(-halfW, 0.13, wz), new THREE.Vector3(halfW, 0.13, wz))
    }

    return new THREE.BufferGeometry().setFromPoints(points)
  }, [gridWidth, gridDepth, cellSize])

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color={COLORS.gridLine} transparent opacity={0.15} depthWrite={false} />
    </lineSegments>
  )
}

// ─── Coordinate labels on edges ─────────────────────────────────

function CoordinateLabels({
  gridWidth,
  gridDepth,
  cellSize,
}: Readonly<{
  readonly gridWidth: number
  readonly gridDepth: number
  readonly cellSize: number
}>) {
  const halfW = (gridWidth * cellSize) / 2
  const halfD = (gridDepth * cellSize) / 2

  const labels = useMemo(() => {
    const result: { text: string; pos: [number, number, number] }[] = []

    // X-axis label
    result.push({ text: 'X →', pos: [halfW + 0.5, 0.14, halfD + 0.25] })
    // X-axis number labels along south edge (z = gridDepth)
    for (let x = 0; x < gridWidth; x += 2) {
      const wx = x * cellSize - halfW + cellSize / 2
      result.push({ text: String(x), pos: [wx, 0.14, halfD + 0.25] })
    }
    // Z-axis label
    result.push({ text: 'Z ↓', pos: [-halfW - 0.6, 0.14, -halfD - 0.15] })
    // Z-axis number labels along west edge (x = 0)
    for (let z = 0; z < gridDepth; z += 2) {
      const wz = z * cellSize - halfD + cellSize / 2
      result.push({ text: String(z), pos: [-halfW - 0.25, 0.14, wz] })
    }

    return result
  }, [gridWidth, gridDepth, cellSize, halfW, halfD])

  return (
    <>
      {labels.map((lbl, _i) => (
        <Html
          key={lbl.text}
          position={lbl.pos as [number, number, number]}
          center
          zIndexRange={[0, 1]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            style={{
              fontSize: lbl.text.includes('→') || lbl.text.includes('↓') ? '16px' : '13px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: '#facc15',
              textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)',
              userSelect: 'none',
            }}
          >
            {lbl.text}
          </span>
        </Html>
      ))}
    </>
  )
}

// ─── Prop labels (shown in focus mode) ──────────────────────────

function PropLabels({ cells }: Readonly<{ cells: CellInstance[] }>) {
  // Only show labels for cells that have a propId and are span parents (no duplicates)
  const labelCells = useMemo(() => {
    const seen = new Set<string>()
    return cells.filter((c) => {
      if (!c.propId) return false
      const key = c.propId + ':' + c.x + ':' + c.z
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [cells])

  if (labelCells.length === 0) return null

  return (
    <>
      {labelCells.map((cell, _i) => (
        <Html
          key={JSON.stringify(cell)}
          position={[cell.worldX, 0.15, cell.worldZ]}
          center
          zIndexRange={[0, 1]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            style={{
              fontSize: '6px',
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(0,0,0,0.55)',
              padding: '1px 3px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {cell.propId}
          </span>
        </Html>
      ))}
    </>
  )
}

// ─── Main overlay component ─────────────────────────────────────

export function GridDebugOverlay({ blueprint }: Omit<GridDebugOverlayProps, 'showLabels'>) {
  const { gridWidth, gridDepth, cellSize, cells } = blueprint

  // Classify all cells and compute world positions
  const byCategory = useMemo(() => {
    const categories: Record<CellCategory, { worldX: number; worldZ: number }[]> = {
      walkable: [],
      blocked: [],
      interaction: [],
      door: [],
    }

    for (let z = 0; z < gridDepth; z++) {
      for (let x = 0; x < gridWidth; x++) {
        const cell = cells[z][x]
        const cat = classifyCell(cell)
        const [wx, , wz] = gridToWorld(x, z, cellSize, gridWidth, gridDepth)
        categories[cat].push({ worldX: wx, worldZ: wz })
      }
    }

    return categories
  }, [cells, cellSize, gridWidth, gridDepth])

  return (
    <group {...({ position: [0, 0.1, 0] } as any)}>
      {/* Cell layers — each instance is individually rotated flat */}
      <CellLayer
        cells={byCategory.walkable}
        cellSize={cellSize}
        opacity={OPACITY.walkable}
        color={COLORS.walkable}
      />
      <CellLayer
        cells={byCategory.blocked}
        cellSize={cellSize}
        opacity={OPACITY.blocked}
        color={COLORS.blocked}
      />
      <CellLayer
        cells={byCategory.interaction}
        cellSize={cellSize}
        opacity={OPACITY.interaction}
        color={COLORS.interaction}
      />
      <CellLayer
        cells={byCategory.door}
        cellSize={cellSize}
        opacity={OPACITY.door}
        color={COLORS.door}
      />

      {/* Grid lines */}
      <GridLines gridWidth={gridWidth} gridDepth={gridDepth} cellSize={cellSize} />
    </group>
  )
}

// Coordinate labels and prop labels live outside the rotated group
// so Html elements orient correctly.
export function GridDebugLabels({
  blueprint,
  showLabels = false,
}: Readonly<GridDebugOverlayProps>) {
  const { gridWidth, gridDepth, cellSize, cells } = blueprint

  const propCells = useMemo(() => {
    const result: CellInstance[] = []
    for (let z = 0; z < gridDepth; z++) {
      for (let x = 0; x < gridWidth; x++) {
        const cell = cells[z][x]
        if (cell.propId) {
          const [wx, , wz] = gridToWorld(x, z, cellSize, gridWidth, gridDepth)
          const cat = classifyCell(cell)
          result.push({
            x,
            z,
            worldX: wx,
            worldZ: wz,
            color: COLORS[cat],
            opacity: OPACITY[cat],
            propId: cell.propId,
          })
        }
      }
    }
    return result
  }, [cells, cellSize, gridWidth, gridDepth])

  return (
    <group>
      <CoordinateLabels gridWidth={gridWidth} gridDepth={gridDepth} cellSize={cellSize} />
      {showLabels && <PropLabels cells={propCells} />}
    </group>
  )
}
