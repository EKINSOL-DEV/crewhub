// ─── Prop Movement Hook ─────────────────────────────────────────
// Handles long-press selection, keyboard movement, and API updates
// for props in the 3D grid world.

import { useState, useCallback, useEffect, useRef } from 'react'
import type { PropPlacement } from '@/lib/grid'

const LONG_PRESS_MS = 600 // 600ms for long-press detection

export type { PropPlacement }

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
}

interface UsePropMovementReturn {
  selectedProp: SelectedProp | null
  isMoving: boolean
  startLongPress: (key: string, propId: string, gridX: number, gridZ: number, rotation: number, span?: { w: number; d: number }) => void
  cancelLongPress: () => void
  handlePointerUp: () => void
}

export function usePropMovement({
  blueprintId,
  gridWidth,
  gridDepth,
  cellSize: _cellSize,
  placements,
  onUpdate,
  apiBaseUrl = 'http://localhost:8091/api',
}: UsePropMovementOptions): UsePropMovementReturn {
  const [selectedProp, setSelectedProp] = useState<SelectedProp | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSelect = useRef<{
    key: string
    propId: string
    gridX: number
    gridZ: number
    rotation: number
    span?: { w: number; d: number }
  } | null>(null)

  // Cancel any pending long-press
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pendingSelect.current = null
  }, [])

  // Start long-press detection
  const startLongPress = useCallback((
    key: string,
    propId: string,
    gridX: number,
    gridZ: number,
    rotation: number,
    span?: { w: number; d: number }
  ) => {
    cancelLongPress()
    
    pendingSelect.current = { key, propId, gridX, gridZ, rotation, span }
    
    longPressTimer.current = setTimeout(() => {
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
  }, [cancelLongPress])

  // Handle pointer up - cancel if it was a short press
  const handlePointerUp = useCallback(() => {
    cancelLongPress()
  }, [cancelLongPress])

  // Check if a position is valid (within bounds and not overlapping)
  const isValidPosition = useCallback((
    x: number, 
    z: number,
    span: { w: number; d: number } = { w: 1, d: 1 },
    excludePropId?: string
  ): boolean => {
    // Check bounds (accounting for walls at edges)
    if (x < 1 || z < 1) return false
    if (x + span.w > gridWidth - 1) return false
    if (z + span.d > gridDepth - 1) return false

    // Check for overlaps with other props (excluding interaction-type props)
    for (const p of placements) {
      if (excludePropId && p.propId === excludePropId && p.x === selectedProp?.originalX && p.z === selectedProp?.originalZ) {
        continue // Skip the prop being moved
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
  }, [gridWidth, gridDepth, placements, selectedProp])

  // Move prop by delta
  const moveProp = useCallback((dx: number, dz: number) => {
    if (!selectedProp) return

    const newX = selectedProp.gridX + dx
    const newZ = selectedProp.gridZ + dz
    const span = selectedProp.span || { w: 1, d: 1 }

    if (isValidPosition(newX, newZ, span, selectedProp.propId)) {
      setSelectedProp(prev => prev ? { ...prev, gridX: newX, gridZ: newZ } : null)
    }
  }, [selectedProp, isValidPosition])

  // Rotate prop by 90 degrees
  const rotateProp = useCallback(() => {
    if (!selectedProp) return
    
    const newRotation = ((selectedProp.rotation || 0) + 90) % 360
    setSelectedProp(prev => prev ? { ...prev, rotation: newRotation } : null)
  }, [selectedProp])

  // Confirm movement and save to API
  const confirmMovement = useCallback(async () => {
    if (!selectedProp) return

    const { propId, gridX, gridZ, originalX, originalZ, rotation } = selectedProp
    
    // Update placements array
    const updatedPlacements = placements.map(p => {
      if (p.propId === propId && p.x === originalX && p.z === originalZ) {
        return { ...p, x: gridX, z: gridZ, rotation: rotation as 0 | 90 | 180 | 270 }
      }
      return p
    })

    // Optimistically update UI
    onUpdate(updatedPlacements)

    // Save to API
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
        }),
      })

      if (!response.ok) {
        console.error('Failed to save prop movement:', await response.text())
        // Revert on failure
        onUpdate(placements)
      }
    } catch (err) {
      console.error('Failed to save prop movement:', err)
      // Revert on failure
      onUpdate(placements)
    }

    setSelectedProp(null)
    setIsMoving(false)
  }, [selectedProp, placements, onUpdate, apiBaseUrl, blueprintId])

  // Cancel movement and restore original position
  const cancelMovement = useCallback(() => {
    setSelectedProp(null)
    setIsMoving(false)
  }, [])

  // Delete prop
  const deleteProp = useCallback(async () => {
    if (!selectedProp) return

    const { propId, originalX, originalZ } = selectedProp
    
    // Remove from placements
    const updatedPlacements = placements.filter(p => 
      !(p.propId === propId && p.x === originalX && p.z === originalZ)
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
        onUpdate(placements)
      }
    } catch (err) {
      console.error('Failed to delete prop:', err)
      // Revert on failure
      onUpdate(placements)
    }

    setSelectedProp(null)
    setIsMoving(false)
  }, [selectedProp, placements, onUpdate, apiBaseUrl, blueprintId])

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

  return {
    selectedProp,
    isMoving,
    startLongPress,
    cancelLongPress,
    handlePointerUp,
  }
}
