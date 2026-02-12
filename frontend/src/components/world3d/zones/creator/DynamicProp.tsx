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

  const geometry = (() => {
    switch (part.type) {
      case 'box': return <boxGeometry args={part.args as any} />
      case 'cylinder': return <cylinderGeometry args={part.args as any} />
      case 'sphere': return <sphereGeometry args={part.args as any} />
      case 'cone': return <coneGeometry args={part.args as any} />
      case 'torus': return <torusGeometry args={part.args as any} />
      default: return <boxGeometry args={[0.3, 0.3, 0.3]} />
    }
  })()

  const rotation = part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
    ? part.rotation as [number, number, number]
    : undefined

  const handleClick = useCallback((e: any) => {
    if (editMode && onSelect) {
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
 * Wraps a single selected part mesh so TransformControls can attach to it.
 * TransformControls is rendered OUTSIDE the scaled group (via portal pattern)
 * to avoid gizmo scaling issues.
 */
function TransformableMesh({
  part,
  index,
  mode,
  parentScale,
  onTransform,
  onDraggingChanged,
}: {
  part: PropPart
  index: number
  mode: 'translate' | 'rotate' | 'scale'
  parentScale: number
  onTransform: (index: number, position: [number, number, number], rotation: [number, number, number]) => void
  onDraggingChanged: (dragging: boolean) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const controlsRef = useRef<any>(null!)
  const isDraggingRef = useRef(false)
  const [meshReady, setMeshReady] = useState(false)

  // Signal mesh is mounted so TransformControls can attach
  useEffect(() => { setMeshReady(true) }, [])

  // Listen for dragging-changed event — commit transform only on drag end
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const cb = (event: any) => {
      const dragging = event.value as boolean
      isDraggingRef.current = dragging
      onDraggingChanged(dragging)

      // On drag END: commit the final position/rotation
      if (!dragging && meshRef.current) {
        const pos = meshRef.current.position
        const rot = meshRef.current.rotation
        onTransform(
          index,
          [pos.x, pos.y, pos.z],
          [rot.x, rot.y, rot.z],
        )
      }
    }
    controls.addEventListener('dragging-changed', cb)
    return () => controls.removeEventListener('dragging-changed', cb)
  }, [onDraggingChanged, onTransform, index])

  const rotation = part.rotation && (part.rotation[0] !== 0 || part.rotation[1] !== 0 || part.rotation[2] !== 0)
    ? part.rotation as [number, number, number]
    : undefined

  const geometry = (() => {
    switch (part.type) {
      case 'box': return <boxGeometry args={part.args as any} />
      case 'cylinder': return <cylinderGeometry args={part.args as any} />
      case 'sphere': return <sphereGeometry args={part.args as any} />
      case 'cone': return <coneGeometry args={part.args as any} />
      case 'torus': return <torusGeometry args={part.args as any} />
      default: return <boxGeometry args={[0.3, 0.3, 0.3]} />
    }
  })()

  // Compute gizmo size relative to parent scale so it looks proportional
  // With parentScale=3, we want the gizmo to appear ~0.5 screen units
  const gizmoSize = 0.5 / Math.max(parentScale, 0.1)

  return (
    <>
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
      {meshReady && meshRef.current && (
        <TransformControls
          ref={controlsRef}
          object={meshRef.current}
          mode={mode}
          size={gizmoSize}
        />
      )}
    </>
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

  const handleBackgroundClick = useCallback((_e: any) => {
    if (editMode && onPartSelect && !isDragging) {
      onPartSelect(null)
    }
    onClick?.()
  }, [editMode, onPartSelect, isDragging, onClick])

  return (
    <group position={position} scale={scale} onClick={handleBackgroundClick}>
      {parts.map((part, i) => {
        if (editMode && selectedPartIndex === i && onPartTransform) {
          return (
            <TransformableMesh
              key={`transform-${i}`}
              part={part}
              index={i}
              mode={transformMode}
              parentScale={scale}
              onTransform={onPartTransform}
              onDraggingChanged={(d) => { setIsDragging(d); handleDraggingChanged(d) }}
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
            onSelect={onPartSelect || undefined}
          />
        )
      })}
    </group>
  )
}
