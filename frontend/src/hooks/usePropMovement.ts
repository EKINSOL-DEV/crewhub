// ─── Prop Movement Hook ─────────────────────────────────────────
// Handles long-press selection, keyboard movement, mouse dragging,
// and API updates for props in the 3D grid world.

import { useState, useCallback, useEffect, useRef } from 'react'
import type { PropPlacement } from '@/lib/grid'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

const LONG_PRESS_MS = 200 // 200ms for long-press detection (reduced from 600 for responsiveness)

// ─── Global prop movement state ────────────────────────────────
// Used by camera controllers to block WASD/mouse look when a prop is selected/dragged
let _isPropBeingMoved = false
let _isPropBeingDragged = false
let _isLongPressPending = false

/** Returns true if a prop is currently selected for movement */
export function getIsPropBeingMoved(): boolean {
  return _isPropBeingMoved
}

/** Returns true if a prop is currently being dragged with the mouse */
export function getIsPropBeingDragged(): boolean {
  return _isPropBeingDragged
}

/** Returns true if a long-press is pending (user holding down on a prop) */
export function getIsLongPressPending(): boolean {
  return _isLongPressPending
}

export type { PropPlacement } // NOSONAR

export interface SelectedProp {
  key: string
  propId: string
  gridX: number
  gridZ: number
  originalX: number
  originalZ: number
  rotation: number
  span?: { w: number; d: number }
}

interface UsePropMovementOptions {
  blueprintId: string
  gridWidth: number
  gridDepth: number
  cellSize: number
  placements: PropPlacement[]
  onUpdate: (placements: PropPlacement[]) => void
  apiBaseUrl?: string
  /** Room position in world space (needed for raycasting) */
  roomPosition?: [number, number, number]
}

interface UsePropMovementReturn {
  selectedProp: SelectedProp | null
  isMoving: boolean
  isDragging: boolean
  isOverInvalid: boolean
  startLongPress: (
    key: string,
    propId: string,
    gridX: number,
    gridZ: number,
    rotation: number,
    span?: { w: number; d: number }
  ) => void
  cancelLongPress: () => void
  handlePointerUp: () => void
  /** Call when pointer moves while dragging (from useFrame or pointer event) */
  handleDragMove: (e: ThreeEvent<PointerEvent>) => void
  /** Call when drag starts (after long-press activates and pointer moves) */
  startDrag: (e: ThreeEvent<PointerEvent>) => void
  /** Call when drag ends */
  endDrag: () => void
  /** Rotate prop by 90 degrees (for HUD button) */
  rotateProp: () => void
  /** Confirm movement and save to API (for HUD button) */
  confirmMovement: () => Promise<void>
  /** Cancel movement and restore original position (for HUD button) */
  cancelMovement: () => void
  /** Delete the selected prop */
  deleteProp: () => Promise<void>
}

export function usePropMovement({
  blueprintId,
  gridWidth,
  gridDepth,
  cellSize,
  placements,
  onUpdate,
  apiBaseUrl = '/api',
  roomPosition = [0, 0, 0],
}: UsePropMovementOptions): UsePropMovementReturn {
  const [selectedProp, setSelectedProp] = useState<SelectedProp | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isOverInvalid, setIsOverInvalid] = useState(false)
  const [, setPendingClear] = useState(false) // NOSONAR
  const placementsRef = useRef(placements)
  placementsRef.current = placements // Always keep ref in sync (avoids stale closures)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSelect = useRef<{
    key: string
    propId: string
    gridX: number
    gridZ: number
    rotation: number
    span?: { w: number; d: number }
  } | null>(null)

  // Drag state
  const dragPlane = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const intersectPoint = useRef<THREE.Vector3>(new THREE.Vector3())

  // Cancel any pending long-press
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pendingSelect.current = null
    _isLongPressPending = false
  }, [])

  // Start long-press detection
  const startLongPress = useCallback(
    (
      key: string,
      propId: string,
      gridX: number,
      gridZ: number,
      rotation: number,
      span?: { w: number; d: number }
    ) => {
      cancelLongPress()

      pendingSelect.current = { key, propId, gridX, gridZ, rotation, span }
      _isLongPressPending = true

      longPressTimer.current = setTimeout(() => {
        _isLongPressPending = false
        if (pendingSelect.current) {
          const { key, propId, gridX, gridZ, rotation, span } = pendingSelect.current
          setSelectedProp({
            key,
            propId,
            gridX,
            gridZ,
            originalX: gridX,
            originalZ: gridZ,
            rotation,
            span,
          })
          setIsMoving(true)
          pendingSelect.current = null
        }
      }, LONG_PRESS_MS)
    },
    [cancelLongPress]
  )

  // Handle pointer up - cancel if it was a short press
  const handlePointerUp = useCallback(() => {
    cancelLongPress()
  }, [cancelLongPress])

  // Check if a position is valid (within bounds and not overlapping)
  // Uses selectedProp.key to uniquely identify the prop being moved (handles duplicate propIds)
  const isValidPosition = useCallback(
    (
      x: number,
      z: number,
      span: { w: number; d: number } = { w: 1, d: 1 },
      excludeKey?: string
    ): boolean => {
      // NOSONAR
      // NOSONAR: complexity from prop movement with collision detection and bounds checking
      // Check bounds — cells 0 and gridSize-1 are wall cells (from createEmptyGrid).
      // Props must stay in the interior: cells 1 to gridSize-2.
      if (x < 1 || z < 1) return false
      if (x + span.w > gridWidth - 1) return false
      if (z + span.d > gridDepth - 1) return false

      // Check for overlaps with other props (excluding interaction-type props)
      for (const p of placements) {
        // Use unique key (propId-x-z) to exclude the prop being moved
        if (excludeKey) {
          const pKey = `${p.propId}-${p.x}-${p.z}`
          if (pKey === excludeKey) continue
        }
        if (p.type === 'interaction') continue // Interaction markers can overlap

        const pSpan = p.span || { w: 1, d: 1 }

        // Check for overlap
        const overlapsX = x < p.x + pSpan.w && x + span.w > p.x
        const overlapsZ = z < p.z + pSpan.d && z + span.d > p.z

        if (overlapsX && overlapsZ) {
          return false
        }
      }

      return true
    },
    [gridWidth, gridDepth, placements]
  )

  // Move prop by delta
  const moveProp = useCallback(
    (dx: number, dz: number) => {
      if (!selectedProp) return

      const newX = selectedProp.gridX + dx
      const newZ = selectedProp.gridZ + dz
      const span = selectedProp.span || { w: 1, d: 1 }

      if (isValidPosition(newX, newZ, span, selectedProp.key)) {
        setSelectedProp((prev) => (prev ? { ...prev, gridX: newX, gridZ: newZ } : null))
      }
    },
    [selectedProp, isValidPosition]
  )

  // Rotate prop by 90 degrees (swap span.w and span.d for 90°/270°)
  const rotateProp = useCallback(() => {
    if (!selectedProp) return

    const newRotation = ((selectedProp.rotation || 0) + 90) % 360
    const currentSpan = selectedProp.span || { w: 1, d: 1 }
    // Swap width and depth on each 90° rotation
    const newSpan = { w: currentSpan.d, d: currentSpan.w }

    // Validate that the rotated span fits at the current position
    if (!isValidPosition(selectedProp.gridX, selectedProp.gridZ, newSpan, selectedProp.key)) {
      // Can't rotate here — span doesn't fit
      return
    }

    setSelectedProp((prev) => (prev ? { ...prev, rotation: newRotation, span: newSpan } : null))
  }, [selectedProp, isValidPosition])

  // Confirm movement and save to API
  const confirmMovement = useCallback(async () => {
    if (!selectedProp) return

    const { propId, gridX, gridZ, originalX, originalZ, rotation, span } = selectedProp

    // Stop dragging first
    setIsDragging(false)

    // Use ref to get latest placements (avoids stale closure if placements changed during drag)
    const currentPlacements = placementsRef.current

    // Update placements array (including span which may have changed due to rotation)
    const updatedPlacements = currentPlacements.map((p) => {
      if (p.propId === propId && p.x === originalX && p.z === originalZ) {
        return { ...p, x: gridX, z: gridZ, rotation: rotation as 0 | 90 | 180 | 270, span }
      }
      return p
    })

    // Optimistically update UI BEFORE clearing selection to prevent flash-back.
    // We update placements first, then clear selection in the same tick via
    // a microtask to ensure React batches both updates together.
    onUpdate(updatedPlacements)

    // Clear selection synchronously — React 18 batches these with the onUpdate above
    setSelectedProp(null)
    setIsMoving(false)
    setPendingClear(false)

    // Save to API (fire-and-forget with revert on failure)
    try {
      const response = await fetch(`${apiBaseUrl}/blueprints/${blueprintId}/move-prop`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propId,
          fromX: originalX,
          fromZ: originalZ,
          toX: gridX,
          toZ: gridZ,
          rotation,
          span,
        }),
      })

      if (!response.ok) {
        console.error('Failed to save prop movement:', await response.text())
        // Revert on failure
        onUpdate(currentPlacements)
        return
      }
    } catch (err) {
      console.error('Failed to save prop movement:', err)
      // Revert on failure
      onUpdate(currentPlacements)
    }
  }, [selectedProp, onUpdate, apiBaseUrl, blueprintId])

  // Cancel movement and restore original position
  const cancelMovement = useCallback(() => {
    setSelectedProp(null)
    setIsMoving(false)
    setIsDragging(false)
    setPendingClear(false)
  }, [])

  // ─── Mouse Drag Handlers ──────────────────────────────────────

  // Convert world position to grid position with snapping
  const worldToGrid = useCallback(
    (worldX: number, worldZ: number): { gridX: number; gridZ: number } => {
      // World coordinates are relative to room center
      // Grid origin is at top-left corner of the grid
      const halfGridWidth = (gridWidth * cellSize) / 2
      const halfGridDepth = (gridDepth * cellSize) / 2

      // Convert from room-relative world coords to grid coords
      const localX = worldX + halfGridWidth
      const localZ = worldZ + halfGridDepth

      // Snap to grid — use Math.floor because gridToWorld places cell centers at
      // gridX * cellSize + cellSize/2, so the cell boundary is at gridX * cellSize.
      const gridX = Math.max(0, Math.min(gridWidth - 1, Math.floor(localX / cellSize)))
      const gridZ = Math.max(0, Math.min(gridDepth - 1, Math.floor(localZ / cellSize)))

      return { gridX, gridZ }
    },
    [gridWidth, gridDepth, cellSize]
  )

  // Start dragging (called when pointer moves after long-press activates)
  const startDrag = useCallback(
    (_e: ThreeEvent<PointerEvent>) => {
      if (!isMoving || !selectedProp) return

      // Set up drag plane at prop's current Y height (floor level = 0.16)
      // Use roomPosition Y so the plane is in world space where the raycaster operates
      const propY = 0.16
      dragPlane.current.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(roomPosition[0], roomPosition[1] + propY, roomPosition[2])
      )

      setIsDragging(true)
    },
    [isMoving, selectedProp, roomPosition]
  )

  // Handle drag movement
  const handleDragMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isDragging || !selectedProp || !e.camera) return

      // Get mouse position in normalized device coordinates
      const pointer = e.pointer

      // Re-align drag plane to camera each frame to handle camera movement during drag
      const propY = 0.16
      dragPlane.current.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(roomPosition[0], roomPosition[1] + propY, roomPosition[2])
      )

      // Update raycaster
      raycaster.current.setFromCamera(pointer, e.camera)

      // Intersect with horizontal plane
      const intersects = raycaster.current.ray.intersectPlane(
        dragPlane.current,
        intersectPoint.current
      )
      if (!intersects) return

      // Convert world position to room-local coordinates
      const localX = intersectPoint.current.x - roomPosition[0]
      const localZ = intersectPoint.current.z - roomPosition[2]

      // Convert to grid coordinates with snapping
      const { gridX: newGridX, gridZ: newGridZ } = worldToGrid(localX, localZ)

      // Check if position is valid and update
      const span = selectedProp.span || { w: 1, d: 1 }
      const valid = isValidPosition(newGridX, newGridZ, span, selectedProp.key)
      setIsOverInvalid(!valid)
      if (valid) {
        if (newGridX !== selectedProp.gridX || newGridZ !== selectedProp.gridZ) {
          setSelectedProp((prev) => (prev ? { ...prev, gridX: newGridX, gridZ: newGridZ } : null))
        }
      }
    },
    [isDragging, selectedProp, roomPosition, worldToGrid, isValidPosition]
  )

  // End dragging
  const endDrag = useCallback(() => {
    setIsDragging(false)
    setIsOverInvalid(false)
  }, [])

  // Delete prop
  const deleteProp = useCallback(async () => {
    if (!selectedProp) return

    const { propId, originalX, originalZ } = selectedProp
    const currentPlacements = placementsRef.current

    // Remove from placements
    const updatedPlacements = currentPlacements.filter(
      (p) => !(p.propId === propId && p.x === originalX && p.z === originalZ)
    )

    // Optimistically update UI
    onUpdate(updatedPlacements)

    // Save to API
    try {
      const response = await fetch(`${apiBaseUrl}/blueprints/${blueprintId}/delete-prop`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propId,
          x: originalX,
          z: originalZ,
        }),
      })

      if (!response.ok) {
        console.error('Failed to delete prop:', await response.text())
        // Revert on failure
        onUpdate(currentPlacements)
      }
    } catch (err) {
      console.error('Failed to delete prop:', err)
      // Revert on failure
      onUpdate(currentPlacements)
    }

    setSelectedProp(null)
    setIsMoving(false)
    setPendingClear(false)
  }, [selectedProp, onUpdate, apiBaseUrl, blueprintId])

  // Keyboard event handler
  useEffect(() => {
    if (!isMoving || !selectedProp) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault()
          moveProp(0, -1) // Move north (negative Z)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault()
          moveProp(0, 1) // Move south (positive Z)
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          moveProp(-1, 0) // Move west (negative X)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          moveProp(1, 0) // Move east (positive X)
          break
        case 'r':
        case 'R':
          e.preventDefault()
          rotateProp()
          break
        case 'Enter':
          e.preventDefault()
          confirmMovement()
          break
        case 'Escape':
          e.preventDefault()
          cancelMovement()
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          deleteProp()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMoving, selectedProp, moveProp, rotateProp, confirmMovement, cancelMovement, deleteProp])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelLongPress()
    }
  }, [cancelLongPress])

  // Sync global prop movement state for camera controllers
  useEffect(() => {
    _isPropBeingMoved = isMoving
    return () => {
      _isPropBeingMoved = false
    }
  }, [isMoving])

  // Sync global drag state for camera controllers
  useEffect(() => {
    _isPropBeingDragged = isDragging
    return () => {
      _isPropBeingDragged = false
    }
  }, [isDragging])

  return {
    selectedProp,
    isMoving,
    isDragging,
    isOverInvalid,
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
  }
}
