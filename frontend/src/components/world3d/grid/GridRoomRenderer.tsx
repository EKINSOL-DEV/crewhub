// ─── Grid Room Renderer ─────────────────────────────────────────
// Renders all props in a room from its RoomBlueprint grid data.
// Replaces the hardcoded RoomProps.tsx per-room components.
// Supports long-press to select and move props with arrow keys/WASD.

import { useMemo, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { gridToWorld } from '@/lib/grid'
import type { RoomBlueprint, PropPlacement } from '@/lib/grid'
import { getPropEntry } from './PropRegistry'
import { useGridDebug } from '@/hooks/useGridDebug'
import { usePropMovement } from '@/hooks/usePropMovement'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

interface GridRoomRendererProps {
  blueprint: RoomBlueprint
  roomPosition: [number, number, number]  // world center of room (y = floor level)
  onBlueprintUpdate?: (placements: PropPlacement[]) => void  // callback when props are moved
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

  // Wall inner face positions — must match the actual 3D wall geometry
  // from RoomWalls.tsx (wallThickness = 0.3, walls at ±halfSize).
  // Inner face = ±(halfSize - wallThickness).
  const WALL_THICKNESS = 0.3
  const northFace = -halfD + WALL_THICKNESS
  const southFace = halfD - WALL_THICKNESS
  const westFace = -halfW + WALL_THICKNESS
  const eastFace = halfW - WALL_THICKNESS

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
  // Wall inner face matches RoomWalls.tsx wallThickness (0.3)
  const WALL_THICKNESS = 0.3
  const INWARD = 0.15 // small inward offset to avoid wall clipping

  let x = worldX
  let z = worldZ

  // Clamp near walls — use actual wall face position (halfSize - wallThickness)
  if (gridX <= 1) x = Math.max(x, -halfW + WALL_THICKNESS + INWARD)
  if (gridX >= gridWidth - 2) x = Math.min(x, halfW - WALL_THICKNESS - INWARD)
  if (gridZ <= 1) z = Math.max(z, -halfD + WALL_THICKNESS + INWARD)
  if (gridZ >= gridDepth - 2) z = Math.min(z, halfD - WALL_THICKNESS - INWARD)

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

// ─── Selection Glow Effect ──────────────────────────────────────

const SELECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 600,
  color: '#fff',
  background: 'rgba(255, 165, 0, 0.9)',
  padding: '4px 10px',
  borderRadius: '8px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'none',
  lineHeight: '18px',
  boxShadow: '0 2px 8px rgba(255, 165, 0, 0.4)',
}

function SelectionIndicator({ position, isMoving }: { position: [number, number, number]; isMoving: boolean }) {
  const labelPos: [number, number, number] = [position[0], position[1] + 2.0, position[2]]

  return (
    <>
      {/* Pulsing ring on the floor around the prop */}
      <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial 
          color="#ffa500" 
          transparent 
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Inner glow circle */}
      <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 32]} />
        <meshBasicMaterial 
          color="#ffa500" 
          transparent 
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Floating instruction label */}
      {isMoving && (
        <Html
          position={labelPos}
          center
          zIndexRange={[100, 110]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={SELECTION_LABEL_STYLE}>
            ↑↓←→ Move • R Rotate • Enter Save • Esc Cancel
          </div>
        </Html>
      )}
    </>
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
 *
 * Long-press (600ms) on a prop to select it for movement.
 * Use arrow keys / WASD to move, R to rotate, Enter to confirm, Escape to cancel.
 */
export function GridRoomRenderer({ blueprint, roomPosition: _roomPosition, onBlueprintUpdate }: GridRoomRendererProps) {
  const { cells, cellSize, gridWidth, gridDepth, id: blueprintId, placements: blueprintPlacements } = blueprint
  const [gridDebugEnabled] = useGridDebug()
  const [hoveredPropKey, setHoveredPropKey] = useState<string | null>(null)
  
  // Use placements from blueprint if available, otherwise extract from cells
  const placements = useMemo<PropPlacement[]>(() => {
    if (blueprintPlacements && blueprintPlacements.length > 0) {
      return blueprintPlacements
    }
    // Fallback: extract from cells (for backwards compatibility)
    const result: PropPlacement[] = []
    for (let z = 0; z < cells.length; z++) {
      for (let x = 0; x < cells[z].length; x++) {
        const cell = cells[z][x]
        if (!cell.propId || cell.spanParent) continue
        result.push({
          propId: cell.propId,
          x,
          z,
          rotation: cell.rotation,
          span: cell.span,
          type: cell.type,
          interactionType: cell.interactionType,
        })
      }
    }
    return result
  }, [blueprintPlacements, cells])

  // Prop movement hook
  const {
    selectedProp,
    isMoving,
    startLongPress,
    cancelLongPress,
    handlePointerUp,
  } = usePropMovement({
    blueprintId: blueprintId || 'unknown',
    gridWidth,
    gridDepth,
    cellSize,
    placements,
    onUpdate: onBlueprintUpdate || (() => {}),
  })

  // Stable callbacks — key is passed via event.object.userData
  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // Walk up to find the group with our debug userData
    let obj = e.eventObject
    if (obj?.userData?.debugPropKey) {
      setHoveredPropKey(obj.userData.debugPropKey)
    }
  }, [])

  // Long-press handlers for prop selection
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const obj = e.eventObject
    if (obj?.userData?.propKey && obj?.userData?.propId !== undefined) {
      const { propKey, propId, gridX, gridZ, rotation, span } = obj.userData
      startLongPress(propKey, propId, gridX, gridZ, rotation || 0, span)
    }
  }, [startLongPress])
  
  const handlePointerUpEvent = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    handlePointerUp()
  }, [handlePointerUp])
  
  const handlePointerLeaveForLongPress = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    cancelLongPress()
    // Also handle debug hover
    let obj = e.eventObject
    if (obj?.userData?.debugPropKey) {
      setHoveredPropKey((prev) => prev === obj.userData.debugPropKey ? null : prev)
    }
  }, [cancelLongPress])

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
        
        // Check if this prop is currently selected and being moved
        const isSelected = selectedProp?.key === key
        const isBeingMoved = isSelected && isMoving
        
        // Use the selected position if this prop is being moved
        const effectiveGridX = isBeingMoved ? selectedProp!.gridX : gridX
        const effectiveGridZ = isBeingMoved ? selectedProp!.gridZ : gridZ
        const effectiveRotation = isBeingMoved ? selectedProp!.rotation : rotation
        
        // Recalculate world position if being moved
        let worldX: number
        let worldZ: number
        if (isBeingMoved) {
          const [newRelX, , newRelZ] = gridToWorld(effectiveGridX, effectiveGridZ, cellSize, gridWidth, gridDepth)
          worldX = newRelX
          worldZ = newRelZ
        } else {
          worldX = position[0]
          worldZ = position[2]
        }
        
        let finalRotation = effectiveRotation

        // Y position from prop metadata (room-local space; parent group handles world Y)
        const yPos = entry.yOffset

        if (entry.mountType === 'wall') {
          // Wall-mounted props: snap toward nearest wall + auto-rotate
          const wallPlacement = getWallPlacement(
            worldX, worldZ, effectiveGridX, effectiveGridZ,
            gridWidth, gridDepth, cellSize,
          )
          if (wallPlacement) {
            worldX = wallPlacement.x
            worldZ = wallPlacement.z
            // Only override rotation if cell didn't specify one explicitly
            if (effectiveRotation === 0) {
              finalRotation = wallPlacement.wallRotation
            }
          }
        } else {
          // Floor props: clamp to room bounds to prevent wall clipping
          const [clampedX, clampedZ] = clampToRoomBounds(
            worldX, worldZ, effectiveGridX, effectiveGridZ,
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
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUpEvent}
            onPointerLeave={handlePointerLeaveForLongPress}
            {...(gridDebugEnabled ? {
              onPointerEnter: handlePointerEnter,
              userData: { debugPropKey: key },
            } : {})}
            userData={{ 
              propKey: key, 
              propId, 
              gridX, 
              gridZ, 
              rotation, 
              span,
              ...(gridDebugEnabled ? { debugPropKey: key } : {}),
            }}
          >
            <Component
              position={worldPos}
              rotation={finalRotation}
              cellSize={cellSize}
              span={span}
            />
            {/* Selection indicator when prop is being moved */}
            {isSelected && (
              <SelectionIndicator position={worldPos} isMoving={isMoving} />
            )}
            {gridDebugEnabled && isHovered && (
              <PropDebugLabel propId={propId} position={worldPos} />
            )}
          </group>
        )
      })}
    </group>
  )
}
