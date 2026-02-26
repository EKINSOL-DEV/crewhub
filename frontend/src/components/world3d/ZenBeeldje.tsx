/**
 * Zen Beeldje - 3D Meditation Statue
 *
 * A clickable zen statue/buddha figure that appears in rooms with projects.
 * Clicking opens Zen Mode focused on that project's tasks.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { getToonMaterialProps } from './utils/toonMaterials'
import type { ThreeEvent } from '@react-three/fiber'
import type { Group } from 'three'

interface ZenBeeldjeProps {
  readonly position?: [number, number, number]
  readonly projectName: string
  readonly projectColor?: string
  readonly onActivate: () => void
}

/**
 * A zen meditation figure that opens project-focused Zen Mode when clicked.
 */
export function ZenBeeldje({
  position = [0, 0, 0],
  projectName,
  projectColor = '#8B7355',
  onActivate,
}: ZenBeeldjeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const groupRef = useRef<Group>(null)

  // Clean up cursor on unmount
  useEffect(() => {
    return () => {
      if (isHovered) {
        document.body.style.cursor = 'auto'
      }
    }
  }, [isHovered])

  // Toon materials for the statue
  const stoneToon = getToonMaterialProps('#9E9684')
  const stoneBaseToon = getToonMaterialProps('#7A7468')
  const glowColor = projectColor || '#a78bfa'

  // Gentle floating animation (always active, more pronounced when hovered)
  useFrame((state) => {
    if (!groupRef.current) return

    const t = state.clock.elapsedTime
    // Always float gently
    const floatAmount = isHovered ? 0.05 : 0.02
    const floatSpeed = isHovered ? 2 : 1.5
    groupRef.current.position.y = position[1] + Math.sin(t * floatSpeed) * floatAmount

    // Subtle rotation when hovered
    if (isHovered) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.1
    } else {
      groupRef.current.rotation.y = 0
    }
  })

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setIsHovered(true)
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    setIsHovered(false)
    document.body.style.cursor = 'auto'
  }, [])

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onActivate()
    },
    [onActivate]
  )

  // Scale up slightly when hovered
  const hoverScale = isHovered ? 1.1 : 1

  return (
    <group
      ref={groupRef}
      position={position}
      scale={hoverScale}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Base/pedestal */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.1, 16]} />
        <meshToonMaterial {...stoneBaseToon} />
      </mesh>

      {/* Body (sitting meditation pose - simplified) */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Crossed legs base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.08, 16]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Top knot / ushnisha */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Arms (simplified - curved cylinders would be better but keeping it simple) */}
      <mesh position={[-0.15, 0.25, 0.08]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>
      <mesh position={[0.15, 0.25, 0.08]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Hands in lap (meditation mudra) */}
      <mesh position={[0, 0.2, 0.12]} castShadow>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshToonMaterial {...stoneToon} />
      </mesh>

      {/* Subtle yellow glow (always visible) */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.5, 32]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.15} />
      </mesh>

      {/* Glow effect when hovered (stronger) */}
      {isHovered && (
        <>
          {/* Outer glow ring */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.5, 32]} />
            <meshBasicMaterial color={glowColor} transparent opacity={0.3} />
          </mesh>

          {/* Aura around statue */}
          <mesh position={[0, 0.35, 0]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color={glowColor} transparent opacity={0.15} />
          </mesh>
        </>
      )}

      {/* Tooltip on hover */}
      {isHovered && (
        <Html position={[0, 0.85, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              border: `2px solid ${glowColor}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🧘</span>
            <span>Zen Mode: {projectName}</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>Click to focus</span>
          </div>
        </Html>
      )}
    </group>
  )
}
