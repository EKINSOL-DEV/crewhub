import { useRef, useState, useCallback, useEffect } from 'react'
import { TransformControls } from '@react-three/drei'
import { useToonMaterialProps } from '../../utils/toonMaterials'
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
  parts: PropPart[]
  position?: [number, number, number]
  scale?: number
  onClick?: () => void
  /** Part editor mode */
  editMode?: boolean
  selectedPartIndex?: number | null
  onPartSelect?: (index: number | null) => void
  onPartTransform?: (index: number, position: [number, number, number], rotation: [number, number, number]) => void
  transformMode?: 'translate' | 'rotate' | 'scale'
  onDraggingChanged?: (dragging: boolean) => void
}

function DynamicMesh({
  part,
  index,
  editMode,
  selected,
  onSelect,
}: {
  part: PropPart
  index: number
  editMode?: boolean
  selected?: boolean
  onSelect?: (index: number) => void
}) {
  const toon = useToonMaterialProps(part.color)
  const meshRef = useRef<THREE.Mesh>(null)

  // Center geometry so pivot point is at visual center
  const centerGeometry = useCallback((geo: THREE.BufferGeometry | null) => {
    if (geo) {
      geo.computeBoundingBox()
      geo.center()
    }
  }, [])

  const geometry = (() => {
    switch (part.type) {
      case 'box': return <boxGeometry ref={centerGeometry} args={part.args as any} />
      case 'cylinder': return <cylinderGeometry ref={centerGeometry} args={part.args as any} />
      case 'sphere': return <sphereGeometry ref={centerGeometry} args={part.args as any} />
      case 'cone': return <coneGeometry ref={centerGeometry} args={part.args as any} />
      case 'torus': return <torusGeometry ref={centerGeometry} args={part.args as any} />
      default: return <boxGeometry ref={centerGeometry} args={[0.3, 0.3, 0.3]} />
    }
  })()

  const rotation = part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
    ? part.rotation as [number, number, number]
    : undefined

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = useCallback((e: any) => {
    if (editMode) {
      pointerDownPos.current = { x: e.clientX ?? e.point?.x ?? 0, y: e.clientY ?? e.point?.y ?? 0 }
    }
  }, [editMode])

  const handleClick = useCallback((e: any) => {
    if (editMode && onSelect) {
      // Only select if pointer didn't move much (not a drag)
      if (pointerDownPos.current) {
        const dx = (e.clientX ?? e.point?.x ?? 0) - pointerDownPos.current.x
        const dy = (e.clientY ?? e.point?.y ?? 0) - pointerDownPos.current.y
        if (Math.abs(dx) + Math.abs(dy) > 5) return // Was a drag, don't select
      }
      e.stopPropagation()
      onSelect(index)
    }
  }, [editMode, onSelect, index])

  return (
    <mesh
      ref={meshRef}
      position={part.position}
      rotation={rotation}
      castShadow
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerOver={editMode ? (e: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={editMode ? () => { document.body.style.cursor = 'auto' } : undefined}
    >
      {geometry}
      {part.emissive ? (
        <meshStandardMaterial
          color={selected ? '#88aaff' : part.color}
          emissive={selected ? '#4466ff' : part.color}
          emissiveIntensity={selected ? 0.8 : 0.5}
        />
      ) : selected ? (
        <meshStandardMaterial
          color={part.color}
          emissive="#4466ff"
          emissiveIntensity={0.4}
        />
      ) : (
        <meshToonMaterial {...toon} />
      )}
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
  part: PropPart
  meshRef: React.RefObject<THREE.Mesh>
}) {
  const rotation = part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
    ? part.rotation as [number, number, number]
    : undefined

  // Center geometry so TransformControls gizmo appears at visual center
  const centerGeometry = useCallback((geo: THREE.BufferGeometry | null) => {
    if (geo) {
      geo.computeBoundingBox()
      geo.center()
    }
  }, [])

  const geometry = (() => {
    switch (part.type) {
      case 'box': return <boxGeometry ref={centerGeometry} args={part.args as any} />
      case 'cylinder': return <cylinderGeometry ref={centerGeometry} args={part.args as any} />
      case 'sphere': return <sphereGeometry ref={centerGeometry} args={part.args as any} />
      case 'cone': return <coneGeometry ref={centerGeometry} args={part.args as any} />
      case 'torus': return <torusGeometry ref={centerGeometry} args={part.args as any} />
      default: return <boxGeometry ref={centerGeometry} args={[0.3, 0.3, 0.3]} />
    }
  })()

  return (
    <mesh
      ref={meshRef}
      castShadow
      position={part.position}
      rotation={rotation}
    >
      {geometry}
      {part.emissive ? (
        <meshStandardMaterial
          color="#88aaff"
          emissive="#4466ff"
          emissiveIntensity={0.8}
        />
      ) : (
        <meshStandardMaterial
          color={part.color}
          emissive="#4466ff"
          emissiveIntensity={0.4}
        />
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
  const handleDraggingChanged = useCallback((dragging: boolean) => {
    onDraggingChangedProp?.(dragging)
  }, [onDraggingChangedProp])
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragPartIndexRef = useRef<number | null>(null)
  const selectedMeshRef = useRef<THREE.Mesh>(null!)
  const controlsRef = useRef<any>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const [meshReady, setMeshReady] = useState(false)

  // Track mesh readiness when selected part changes
  useEffect(() => { setMeshReady(false) }, [selectedPartIndex])
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
      setIsDragging(dragging)
      isDraggingRef.current = dragging
      handleDraggingChanged(dragging)

      if (dragging) {
        // Remember which part we're dragging (separate from selection)
        dragPartIndexRef.current = selectedPartIndex ?? null
      }

      // On drag END: commit final position/rotation using the DRAGGED part index
      if (!dragging && selectedMeshRef.current && dragPartIndexRef.current != null && onPartTransform) {
        const pos = selectedMeshRef.current.position
        const rot = selectedMeshRef.current.rotation
        onPartTransform(
          dragPartIndexRef.current,
          [pos.x, pos.y, pos.z],
          [rot.x, rot.y, rot.z],
        )
        dragPartIndexRef.current = null
        // Keep isDraggingRef true briefly to block the click event that fires on mouseup
        setTimeout(() => { isDraggingRef.current = false }, 50)
        return // Don't set isDraggingRef to false synchronously
      }
    }
    controls.addEventListener('dragging-changed', cb)
    return () => controls.removeEventListener('dragging-changed', cb)
  }, [handleDraggingChanged, onPartTransform, selectedPartIndex])

  // Wrap onPartSelect to block clicks during/right after drag
  const handlePartSelect = useCallback((index: number | null) => {
    // Block selection changes while dragging or immediately after
    if (isDraggingRef.current) return
    onPartSelect?.(index)
  }, [onPartSelect])

  const handleBackgroundClick = useCallback((_e: any) => {
    if (isDraggingRef.current) return
    if (editMode && onPartSelect) {
      onPartSelect(null)
    }
    onClick?.()
  }, [editMode, onPartSelect, onClick])

  const hasSelection = editMode && selectedPartIndex != null && onPartTransform

  return (
    <>
      <group ref={groupRef} position={position} scale={scale} onClick={handleBackgroundClick}>
        {parts.map((part, i) => {
          if (editMode && selectedPartIndex === i && onPartTransform) {
            return (
              <SelectedPartMesh
                key={`selected-${i}`}
                part={part}
                meshRef={selectedMeshRef}
              />
            )
          }
          return (
            <DynamicMesh
              key={i}
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
