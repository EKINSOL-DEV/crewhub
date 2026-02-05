// ─── Grid Room Renderer ─────────────────────────────────────────
// Renders all props in a room from its RoomBlueprint grid data.
// Replaces the hardcoded RoomProps.tsx per-room components.

import { useMemo, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { gridToWorld } from '@/lib/grid'
import type { RoomBlueprint } from '@/lib/grid'
import { getPropEntry } from './PropRegistry'
import { useGridDebug } from '@/hooks/useGridDebug'
import type { ThreeEvent } from '@react-three/fiber'

interface GridRoomRendererProps {
  blueprint: RoomBlueprint
  roomPosition: [number, number, number]  // world center of room (y = floor level)
}

interface PropInstance {
  key: string
  propId: string
  gridX: number
  gridZ: number
  position: [number, number, number]
  rotation: number
  span?: { w: number; d: number }
}

// ─── Wall positioning helpers ───────────────────────────────────

/** Determine which wall is nearest and return snapped position + rotation.
 *  Returns null if prop is not within wallThreshold cells of a wall. */
function getWallPlacement(
  worldX: number,
  worldZ: number,
  gridX: number,
  gridZ: number,
  gridWidth: number,
  gridDepth: number,
  cellSize: number,
): { x: number; z: number; wallRotation: number } | null {
  const halfW = (gridWidth * cellSize) / 2
  const halfD = (gridDepth * cellSize) / 2

  // Distance in grid cells from the interior edge of each wall.
  // Wall cells are at 0 and gridSize-1; interior starts at 1 and gridSize-2.
  const distNorth = gridZ - 1
  const distSouth = (gridDepth - 2) - gridZ
  const distWest = gridX - 1
  const distEast = (gridWidth - 2) - gridX

  const minDist = Math.min(distNorth, distSouth, distWest, distEast)

  // Only snap to wall if within 1 cell of wall interior edge
  if (minDist > 1) return null

  // Small gap from wall surface to prevent z-fighting
  const WALL_GAP = 0.05

  // Wall inner face positions (inner edge of the wall cell)
  const northFace = -halfD + cellSize
  const southFace = halfD - cellSize
  const westFace = -halfW + cellSize
  const eastFace = halfW - cellSize

  // Snap to nearest wall and set rotation to face into room.
  // Default geometry faces +Z, so:
  //   North wall → face south (+Z) → 0°
  //   South wall → face north (-Z) → 180°
  //   West wall  → face east (+X)  → 270°
  //   East wall  → face west (-X)  → 90°
  if (distNorth === minDist) {
    return { x: worldX, z: northFace + WALL_GAP, wallRotation: 0 }
  }
  if (distSouth === minDist) {
    return { x: worldX, z: southFace - WALL_GAP, wallRotation: 180 }
  }
  if (distWest === minDist) {
    return { x: westFace + WALL_GAP, z: worldZ, wallRotation: 270 }
  }
  // East
  return { x: eastFace - WALL_GAP, z: worldZ, wallRotation: 90 }
}

/** Clamp floor-prop positions inward to prevent wall clipping at grid edges. */
function clampToRoomBounds(
  worldX: number,
  worldZ: number,
  gridX: number,
  gridZ: number,
  gridWidth: number,
  gridDepth: number,
  cellSize: number,
): [number, number] {
  const halfW = (gridWidth * cellSize) / 2
  const halfD = (gridDepth * cellSize) / 2
  const INWARD = 0.15 // small inward offset to avoid wall clipping

  let x = worldX
  let z = worldZ

  // Clamp near walls (grid cells 1 and gridSize-2 are just inside the wall)
  if (gridX <= 1) x = Math.max(x, -halfW + cellSize + INWARD)
  if (gridX >= gridWidth - 2) x = Math.min(x, halfW - cellSize - INWARD)
  if (gridZ <= 1) z = Math.max(z, -halfD + cellSize + INWARD)
  if (gridZ >= gridDepth - 2) z = Math.min(z, halfD - cellSize - INWARD)

  return [x, z]
}

// ─── Debug hover label ──────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'monospace',
  fontWeight: 600,
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.80)',
  padding: '2px 8px',
  borderRadius: '10px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'none',
  lineHeight: '18px',
  letterSpacing: '0.02em',
}

function PropDebugLabel({ propId, position }: { propId: string; position: [number, number, number] }) {
  // Position label above the prop (Y + 1.2 units above placement)
  const labelPos: [number, number, number] = [position[0], position[1] + 1.2, position[2]]

  return (
    <Html
      position={labelPos}
      center
      zIndexRange={[10, 20]}
      style={{ pointerEvents: 'none' }}
    >
      <span style={LABEL_STYLE}>
        {propId}
      </span>
    </Html>
  )
}

// ─── Renderer ───────────────────────────────────────────────────

/**
 * Renders all props in a room by iterating over the blueprint grid.
 * Skips spanParent cells (only renders from the anchor cell of multi-cell props).
 * Skips interaction-only and empty cells.
 *
 * Handles per-prop Y positioning (room-local space, parent group handles world Y):
 *  - Floor props: Y = 0.16 (floor surface)
 *  - Wall props: Y = propEntry.yOffset (wall mount height, e.g. 1.2 for whiteboards)
 *    Wall props also get snapped toward the nearest wall and rotated to face inward.
 */
export function GridRoomRenderer({ blueprint, roomPosition: _roomPosition }: GridRoomRendererProps) {
  const { cells, cellSize, gridWidth, gridDepth } = blueprint
  const [gridDebugEnabled] = useGridDebug()
  const [hoveredPropKey, setHoveredPropKey] = useState<string | null>(null)

  // Stable callbacks — key is passed via event.object.userData
  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // Walk up to find the group with our debug userData
    let obj = e.eventObject
    if (obj?.userData?.debugPropKey) {
      setHoveredPropKey(obj.userData.debugPropKey)
    }
  }, [])

  const handlePointerLeave = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    let obj = e.eventObject
    if (obj?.userData?.debugPropKey) {
      setHoveredPropKey((prev) => prev === obj.userData.debugPropKey ? null : prev)
    }
  }, [])

  // Build list of prop instances from grid (memoized per blueprint)
  const propInstances = useMemo(() => {
    const instances: PropInstance[] = []

    for (let z = 0; z < cells.length; z++) {
      for (let x = 0; x < cells[z].length; x++) {
        const cell = cells[z][x]

        // Skip empty cells, walls, doors, and cells without props
        if (!cell.propId) continue

        // Skip spanParent cells (rendered from their anchor)
        if (cell.spanParent) continue

        // Get the entry — skip if not registered
        const entry = getPropEntry(cell.propId)
        if (!entry) continue

        // Convert grid coords to world coords (relative to room center)
        const [relX, , relZ] = gridToWorld(x, z, cellSize, gridWidth, gridDepth)

        instances.push({
          key: `${cell.propId}-${x}-${z}`,
          propId: cell.propId,
          gridX: x,
          gridZ: z,
          position: [relX, 0, relZ],
          rotation: cell.rotation ?? 0,
          span: cell.span,
        })
      }
    }

    return instances
  }, [cells, cellSize, gridWidth, gridDepth])

  return (
    <group>
      {propInstances.map(({ key, propId, gridX, gridZ, position, rotation, span }) => {
        const entry = getPropEntry(propId)
        if (!entry) return null

        const Component = entry.component

        // Y position from prop metadata (room-local space; parent group handles world Y)
        const yPos = entry.yOffset

        let worldX = position[0]
        let worldZ = position[2]
        let finalRotation = rotation

        if (entry.mountType === 'wall') {
          // Wall-mounted props: snap toward nearest wall + auto-rotate
          const wallPlacement = getWallPlacement(
            worldX, worldZ, gridX, gridZ,
            gridWidth, gridDepth, cellSize,
          )
          if (wallPlacement) {
            worldX = wallPlacement.x
            worldZ = wallPlacement.z
            // Only override rotation if cell didn't specify one explicitly
            if (rotation === 0) {
              finalRotation = wallPlacement.wallRotation
            }
          }
        } else {
          // Floor props: clamp to room bounds to prevent wall clipping
          const [clampedX, clampedZ] = clampToRoomBounds(
            worldX, worldZ, gridX, gridZ,
            gridWidth, gridDepth, cellSize,
          )
          worldX = clampedX
          worldZ = clampedZ
        }

        const worldPos: [number, number, number] = [worldX, yPos, worldZ]
        const isHovered = hoveredPropKey === key

        return (
          <group
            key={key}
            {...(gridDebugEnabled ? {
              onPointerEnter: handlePointerEnter,
              onPointerLeave: handlePointerLeave,
              userData: { debugPropKey: key },
            } : {})}
          >
            <Component
              position={worldPos}
              rotation={finalRotation}
              cellSize={cellSize}
              span={span}
            />
            {gridDebugEnabled && isHovered && (
              <PropDebugLabel propId={propId} position={worldPos} />
            )}
          </group>
        )
      })}
    </group>
  )
}
