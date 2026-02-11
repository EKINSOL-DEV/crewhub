// ─── Grid Room Renderer ─────────────────────────────────────────
// Renders all props in a room from its RoomBlueprint grid data.
// Replaces the hardcoded RoomProps.tsx per-room components.
// Supports long-press to select and move props with arrow keys/WASD.

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
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

// Minimum movement threshold to start drag (in pixels, to avoid accidental drags)
const DRAG_THRESHOLD = 5

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

// ─── Hover Glow Effect ──────────────────────────────────────────

function HoverGlow({ position }: { position: [number, number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + Math.sin(t * 3) * 0.15
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + Math.sin(t * 2) * 0.04
    }
  })
  
  return (
    <group>
      {/* Pulsing outline ring */}
      <mesh ref={ringRef} position={[position[0], 0.03, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.7, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Subtle inner glow */}
      <mesh ref={glowRef} position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ─── Selection Glow Effect ──────────────────────────────────────

// ─── HUD Button Styles ──────────────────────────────────────────

const HUD_CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
}

const HUD_BUTTON_STYLE: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '18px',
  fontWeight: 'bold',
  transition: 'transform 0.1s, box-shadow 0.1s',
  userSelect: 'none',
}

const HUD_SAVE_STYLE: React.CSSProperties = {
  ...HUD_BUTTON_STYLE,
  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
}

const HUD_ROTATE_STYLE: React.CSSProperties = {
  ...HUD_BUTTON_STYLE,
  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
}

const HUD_DELETE_STYLE: React.CSSProperties = {
  ...HUD_BUTTON_STYLE,
  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
}

const HUD_CANCEL_STYLE: React.CSSProperties = {
  ...HUD_BUTTON_STYLE,
  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
}

const HUD_HINT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'system-ui, sans-serif',
  color: 'rgba(255, 255, 255, 0.8)',
  background: 'rgba(0, 0, 0, 0.6)',
  padding: '4px 10px',
  borderRadius: '12px',
  whiteSpace: 'nowrap',
  marginTop: '8px',
}

interface SelectionIndicatorProps {
  position: [number, number, number]
  isMoving: boolean
  isDragging: boolean
  onSave: () => void
  onRotate: () => void
  onCancel: () => void
  onDelete: () => void
}

function SelectionIndicator({ position, isMoving, isDragging, onSave, onRotate, onCancel, onDelete }: SelectionIndicatorProps) {
  const hudPos: [number, number, number] = [position[0], position[1] + 1.8, position[2]]

  return (
    <>
      {/* Pulsing ring on the floor around the prop */}
      <mesh position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial 
          color={isDragging ? '#00ff88' : '#ffa500'} 
          transparent 
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Inner glow circle */}
      <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 32]} />
        <meshBasicMaterial 
          color={isDragging ? '#00ff88' : '#ffa500'} 
          transparent 
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* HUD Buttons floating above the prop */}
      {isMoving && (
        <Html
          position={hudPos}
          center
          zIndexRange={[100, 110]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={HUD_CONTAINER_STYLE}>
              {/* Save Button */}
              <button
                style={HUD_SAVE_STYLE}
                onClick={(e) => { e.stopPropagation(); onSave(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Save position"
              >
                ✓
              </button>
              
              {/* Rotate Button */}
              <button
                style={HUD_ROTATE_STYLE}
                onClick={(e) => { e.stopPropagation(); onRotate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Rotate 90°"
              >
                🔄
              </button>
              
              {/* Delete Button */}
              <button
                style={HUD_DELETE_STYLE}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Delete prop"
              >
                🗑️
              </button>
              
              {/* Cancel Button */}
              <button
                style={HUD_CANCEL_STYLE}
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                onPointerDown={(e) => e.stopPropagation()}
                title="Cancel"
              >
                ✕
              </button>
            </div>
            
            {/* Hint text */}
            <div style={HUD_HINT_STYLE}>
              {isDragging ? 'Release to drop' : 'Drag to move • Arrows/WASD'}
            </div>
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
// ─── Lifted/Bobbing Animation Constants ─────────────────────────
const LIFT_HEIGHT = 0.4        // How high the prop lifts when selected
const BOB_AMPLITUDE = 0.05    // Subtle bobbing amplitude
const BOB_SPEED = 2           // Bobbing speed multiplier

/** Wrapper that animates Y position via ref (no re-renders). */
function BobbingWrapper({ children, active, baseY }: { children: React.ReactNode; active: boolean; baseY: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  
  useFrame((state) => {
    if (!groupRef.current) return
    if (active) {
      const bob = Math.sin(state.clock.getElapsedTime() * BOB_SPEED) * BOB_AMPLITUDE
      groupRef.current.position.y = baseY + LIFT_HEIGHT + bob
    } else {
      groupRef.current.position.y = baseY
    }
  })
  
  return <group ref={groupRef} position={[0, baseY, 0]}>{children}</group>
}

export function GridRoomRenderer({ blueprint, roomPosition, onBlueprintUpdate }: GridRoomRendererProps) {
  const { cells, cellSize, gridWidth, gridDepth, id: blueprintId, placements: blueprintPlacements } = blueprint
  const [gridDebugEnabled] = useGridDebug()
  const [hoveredPropKey, setHoveredPropKey] = useState<string | null>(null)
  
  // Track pointer position for drag threshold detection
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null)
  const hasDragStarted = useRef(false)
  
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

  // Prop movement hook (with room position for raycasting)
  const {
    selectedProp,
    isMoving,
    isDragging,
    startLongPress,
    cancelLongPress,
    handlePointerUp,
    handleDragMove,
    startDrag,
    endDrag,
    rotateProp,
    confirmMovement,
    cancelMovement,
    deleteProp,
  } = usePropMovement({
    blueprintId: blueprintId || 'unknown',
    gridWidth,
    gridDepth,
    cellSize,
    placements,
    onUpdate: onBlueprintUpdate || (() => {}),
    roomPosition,
  })

  // Stable callbacks — key is passed via event.object.userData
  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const obj = e.eventObject
    if (obj?.userData?.propKey) {
      setHoveredPropKey(obj.userData.propKey)
      // Show grab cursor when hovering a movable prop (or pointer if already moving)
      if (isMoving) {
        document.body.style.cursor = isDragging ? 'grabbing' : 'grab'
      } else {
        document.body.style.cursor = 'grab'
      }
    } else if (obj?.userData?.debugPropKey) {
      setHoveredPropKey(obj.userData.debugPropKey)
    }
  }, [isMoving, isDragging])

  // Long-press handlers for prop selection and mouse drag
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const obj = e.eventObject
    if (obj?.userData?.propKey && obj?.userData?.propId !== undefined) {
      const { propKey, propId, gridX, gridZ, rotation, span } = obj.userData
      startLongPress(propKey, propId, gridX, gridZ, rotation || 0, span)
      // Store pointer position for drag threshold detection
      pointerStartPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
      hasDragStarted.current = false
    }
  }, [startLongPress])
  
  const handlePointerMoveEvent = useCallback((e: ThreeEvent<PointerEvent>) => {
    // Only process if a prop is selected for moving
    if (!isMoving) return
    
    // Check drag threshold before starting drag
    if (!hasDragStarted.current && pointerStartPos.current) {
      const dx = e.nativeEvent.clientX - pointerStartPos.current.x
      const dy = e.nativeEvent.clientY - pointerStartPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance >= DRAG_THRESHOLD) {
        hasDragStarted.current = true
        startDrag(e)
        document.body.style.cursor = 'grabbing'
      }
    }
    
    // If dragging, update position
    if (isDragging) {
      handleDragMove(e)
    }
  }, [isMoving, isDragging, startDrag, handleDragMove])
  
  const handlePointerUpEvent = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    handlePointerUp()
    // End drag if we were dragging
    if (isDragging) {
      endDrag()
      document.body.style.cursor = isMoving ? 'grab' : 'auto'
    }
    pointerStartPos.current = null
    hasDragStarted.current = false
  }, [handlePointerUp, isDragging, isMoving, endDrag])
  
  const handlePointerLeaveForLongPress = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // Don't cancel if we're dragging - the user might move outside the prop temporarily
    if (!isDragging) {
      cancelLongPress()
      if (!isMoving) {
        document.body.style.cursor = 'auto'
      }
    }
    // Clear hover
    const obj = e.eventObject
    const key = obj?.userData?.propKey || obj?.userData?.debugPropKey
    if (key) {
      setHoveredPropKey((prev) => prev === key ? null : prev)
    }
  }, [cancelLongPress, isDragging, isMoving])

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

  // Global drag handler for when mouse moves outside the prop
  const handleGlobalPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      handleDragMove(e)
    }
  }, [isDragging, handleDragMove])

  const handleGlobalPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      e.stopPropagation()
      endDrag()
      pointerStartPos.current = null
      hasDragStarted.current = false
    }
  }, [isDragging, endDrag])

  // Reset cursor when movement ends
  useEffect(() => {
    if (!isMoving) {
      document.body.style.cursor = 'auto'
    }
  }, [isMoving])

  return (
    <group>
      {/* Invisible drag capture plane - only visible during drag */}
      {isDragging && (
        <mesh
          position={[0, 0.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerMove={handleGlobalPointerMove}
          onPointerUp={handleGlobalPointerUp}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      
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
        let yPos = entry.yOffset

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
            onPointerMove={handlePointerMoveEvent}
            onPointerUp={handlePointerUpEvent}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeaveForLongPress}
            userData={{ 
              propKey: key, 
              propId, 
              gridX: effectiveGridX, 
              gridZ: effectiveGridZ, 
              rotation: effectiveRotation, 
              span,
              ...(gridDebugEnabled ? { debugPropKey: key } : {}),
            }}
          >
            <BobbingWrapper active={isBeingMoved} baseY={yPos}>
              <Component
                position={[worldPos[0], 0, worldPos[2]]}
                rotation={finalRotation}
                cellSize={cellSize}
                span={span}
              />
            </BobbingWrapper>
            {/* Selection indicator when prop is being moved */}
            {isSelected && (
              <SelectionIndicator 
                position={worldPos} 
                isMoving={isMoving} 
                isDragging={isDragging}
                onSave={confirmMovement}
                onRotate={rotateProp}
                onCancel={cancelMovement}
                onDelete={deleteProp}
              />
            )}
            {/* Hover glow when not selected */}
            {isHovered && !isSelected && (
              <HoverGlow position={worldPos} />
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
