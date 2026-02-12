import { useRef, useState, useCallback } from 'react'
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
 */
function TransformableMesh({
  part,
  index,
  mode,
  onTransform,
  onDraggingChanged,
}: {
  part: PropPart
  index: number
  mode: 'translate' | 'rotate' | 'scale'
  onTransform: (index: number, position: [number, number, number], rotation: [number, number, number]) => void
  onDraggingChanged: (dragging: boolean) => void
}) {
  const groupRef = useRef<THREE.Group>(null!)

  const handleChange = useCallback(() => {
    if (!groupRef.current) return
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    onTransform(
      index,
      [pos.x, pos.y, pos.z],
      [rot.x, rot.y, rot.z],
    )
  }, [index, onTransform])

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

  return (
    <TransformControls
      mode={mode}
      size={0.6}
      object={groupRef}
      onObjectChange={handleChange}
      onMouseDown={() => onDraggingChanged(true)}
      onMouseUp={() => onDraggingChanged(false)}
    >
      <group ref={groupRef} position={part.position} rotation={rotation}>
        <mesh castShadow>
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
      </group>
    </TransformControls>
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
      // Click on background → deselect
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
              key={i}
              part={part}
              index={i}
              mode={transformMode}
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
