import { useRef, useState, useCallback, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { getToonMaterialProps } from '../../utils/toonMaterials'
import * as THREE from 'three'

export interface PropPart {
  type: string // "box" | "cylinder" | "sphere" | "cone" | "torus"
  position: [number, number, number]
  rotation?: [number, number, number]
  args: number[]
  color: string
  emissive?: boolean
}

interface DynamicPropProps {
  readonly parts: PropPart[]
  readonly position?: [number, number, number]
  readonly scale?: number
  readonly onClick?: () => void
  /** Part editor mode */
  readonly editMode?: boolean
  readonly selectedPartIndex?: number | null
  readonly onPartSelect?: (index: number | null) => void
  readonly onPartTransform?: (
    index: number,
    position: [number, number, number],
    rotation: [number, number, number]
  ) => void
  readonly transformMode?: 'translate' | 'rotate' | 'scale'
  readonly onDraggingChanged?: (dragging: boolean) => void
}

function PartGeometry({
  type,
  args,
  onRef,
}: {
  type: string
  args: any
  onRef: (geo: THREE.BufferGeometry | null) => void
}) {
  switch (type) {
    case 'box':
      return <boxGeometry ref={onRef} args={args} />
    case 'cylinder':
      return <cylinderGeometry ref={onRef} args={args} />
    case 'sphere':
      return <sphereGeometry ref={onRef} args={args} />
    case 'cone':
      return <coneGeometry ref={onRef} args={args} />
    case 'torus':
      return <torusGeometry ref={onRef} args={args} />
    default:
      return <boxGeometry ref={onRef} args={[0.3, 0.3, 0.3]} />
  }
}

function DynamicMesh({
  // NOSONAR: 3D mesh component with edit mode interactions
  part,
  index,
  editMode,
  selected,
  onSelect,
}: {
  readonly part: PropPart
  readonly index: number
  readonly editMode?: boolean
  readonly selected?: boolean
  readonly onSelect?: (index: number) => void
}) {
  const toon = getToonMaterialProps(part.color)
  const meshRef = useRef<THREE.Mesh>(null)

  const centerGeometry = useCallback((geo: THREE.BufferGeometry | null) => {
    if (geo) {
      geo.computeBoundingBox()
      geo.center()
    }
  }, [])

  const rotation =
    part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
      ? part.rotation
      : undefined

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = useCallback(
    (e: any) => {
      if (editMode) {
        pointerDownPos.current = {
          x: e.clientX ?? e.point?.x ?? 0,
          y: e.clientY ?? e.point?.y ?? 0,
        }
      }
    },
    [editMode]
  )

  const hasSelectionHandler = editMode && !!onSelect

  const didMoveWhilePressing = useCallback((e: any) => {
    if (!pointerDownPos.current) return false
    const dx = (e.clientX ?? e.point?.x ?? 0) - pointerDownPos.current.x
    const dy = (e.clientY ?? e.point?.y ?? 0) - pointerDownPos.current.y
    return Math.abs(dx) + Math.abs(dy) > 5
  }, [])

  const handleClick = useCallback(
    (e: any) => {
      if (!hasSelectionHandler) return
      if (didMoveWhilePressing(e)) return
      e.stopPropagation()
      onSelect?.(index)
    },
    [hasSelectionHandler, didMoveWhilePressing, onSelect, index]
  )

  const handlePointerOver = useCallback(
    (e: any) => {
      if (!editMode) return
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    [editMode]
  )

  const handlePointerOut = useCallback(() => {
    if (!editMode) return
    document.body.style.cursor = 'auto'
  }, [editMode])

  const renderMaterial = () => {
    if (part.emissive) {
      return (
        <meshStandardMaterial
          color={selected ? '#88aaff' : part.color}
          emissive={selected ? '#4466ff' : part.color}
          emissiveIntensity={selected ? 0.8 : 0.5}
        />
      )
    }

    if (selected) {
      return <meshStandardMaterial color={part.color} emissive="#4466ff" emissiveIntensity={0.4} />
    }

    return <meshToonMaterial {...toon} />
  }

  return (
    <mesh
      ref={meshRef}
      position={part.position}
      rotation={rotation}
      castShadow
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerOver={editMode ? handlePointerOver : undefined}
      onPointerOut={editMode ? handlePointerOut : undefined}
    >
      <PartGeometry type={part.type} args={part.args as any} onRef={centerGeometry} />
      {renderMaterial()}
    </mesh>
  )
}

/**
 * Selected part mesh — just the mesh with highlight material.
 * TransformControls is rendered OUTSIDE the scaled group by the parent component.
 */
function SelectedPartMesh({
  part,
  meshRef,
}: {
  readonly part: PropPart
  readonly meshRef: React.RefObject<THREE.Mesh>
}) {
  const rotation =
    part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
      ? part.rotation
      : undefined

  const centerGeometry = useCallback((geo: THREE.BufferGeometry | null) => {
    if (geo) {
      geo.computeBoundingBox()
      geo.center()
    }
  }, [])

  return (
    <mesh ref={meshRef} castShadow position={part.position} rotation={rotation}>
      <PartGeometry type={part.type} args={part.args as any} onRef={centerGeometry} />
      {part.emissive ? (
        <meshStandardMaterial color="#88aaff" emissive="#4466ff" emissiveIntensity={0.8} />
      ) : (
        <meshStandardMaterial color={part.color} emissive="#4466ff" emissiveIntensity={0.4} />
      )}
    </mesh>
  )
}

/**
 * Renders a prop from structured parts data — no eval needed.
 * Supports edit mode with part selection and transform controls.
 */
export function DynamicProp({
  parts,
  position = [0, 0, 0],
  scale = 1,
  onClick,
  editMode,
  selectedPartIndex,
  onPartSelect,
  onPartTransform,
  transformMode = 'translate',
  onDraggingChanged: onDraggingChangedProp,
}: DynamicPropProps) {
  const handleDraggingChanged = useCallback(
    (dragging: boolean) => {
      onDraggingChangedProp?.(dragging)
    },
    [onDraggingChangedProp]
  )
  const isDraggingRef = useRef(false)
  const dragPartIndexRef = useRef<number | null>(null)
  const selectedMeshRef = useRef<THREE.Mesh>(null!)
  const controlsRef = useRef<any>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const [meshReady, setMeshReady] = useState(false)

  // Track mesh readiness when selected part changes
  useEffect(() => {
    setMeshReady(false)
  }, [selectedPartIndex])
  useEffect(() => {
    if (selectedPartIndex != null && selectedMeshRef.current) {
      // Ensure world matrix is up to date before TransformControls reads it
      selectedMeshRef.current.updateWorldMatrix(true, false)
      setMeshReady(true)
    }
  })

  // Listen for dragging-changed on TransformControls
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const cb = (event: any) => {
      const dragging = event.value as boolean
      isDraggingRef.current = dragging
      handleDraggingChanged(dragging)

      if (dragging) {
        // Remember which part we're dragging (separate from selection)
        dragPartIndexRef.current = selectedPartIndex ?? null
      }

      // On drag END: commit final position/rotation using the DRAGGED part index
      if (
        !dragging &&
        selectedMeshRef.current &&
        dragPartIndexRef.current != null &&
        onPartTransform
      ) {
        const pos = selectedMeshRef.current.position
        const rot = selectedMeshRef.current.rotation
        onPartTransform(dragPartIndexRef.current, [pos.x, pos.y, pos.z], [rot.x, rot.y, rot.z])
        dragPartIndexRef.current = null
        // Keep isDraggingRef true briefly to block the click event that fires on mouseup
        setTimeout(() => {
          isDraggingRef.current = false
        }, 50)
        return // Don't set isDraggingRef to false synchronously
      }
    }
    controls.addEventListener('dragging-changed', cb)
    return () => controls.removeEventListener('dragging-changed', cb)
  }, [handleDraggingChanged, onPartTransform, selectedPartIndex])

  // Wrap onPartSelect to block clicks during/right after drag
  const handlePartSelect = useCallback(
    (index: number | null) => {
      // Block selection changes while dragging or immediately after
      if (isDraggingRef.current) return
      onPartSelect?.(index)
    },
    [onPartSelect]
  )

  const handleBackgroundClick = useCallback(
    (_e: any) => {
      if (isDraggingRef.current) return
      if (editMode && onPartSelect) {
        onPartSelect(null)
      }
      onClick?.()
    },
    [editMode, onPartSelect, onClick]
  )

  const hasSelection = editMode && selectedPartIndex != null && onPartTransform

  return (
    <>
      <group ref={groupRef} position={position} scale={scale} onClick={handleBackgroundClick}>
        {parts.map((part, i) => {
          if (editMode && selectedPartIndex === i && onPartTransform) {
            return (
              <SelectedPartMesh key={JSON.stringify(part)} part={part} meshRef={selectedMeshRef} />
            )
          }
          return (
            <DynamicMesh
              key={JSON.stringify(part)}
              part={part}
              index={i}
              editMode={editMode}
              selected={editMode && selectedPartIndex === i}
              onSelect={handlePartSelect}
            />
          )
        })}
      </group>
      {/* TransformControls OUTSIDE the scaled group to avoid double-transform */}
      {hasSelection && meshReady && selectedMeshRef.current && (
        <TransformControls
          ref={controlsRef}
          object={selectedMeshRef.current}
          mode={transformMode}
          size={0.5}
        />
      )}
    </>
  )
}
