/**
 * MeetingTable — 3D interactive round meeting table for HQ room.
 *
 * Procedural geometry: thick cylinder pedestal + thin disc top.
 * Clickable with hover glow. Shows "Meeting in Progress" indicator
 * (pulsing ring) when a meeting is active.
 */

import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useToonMaterialProps, WARM_COLORS } from '../utils/toonMaterials'
import { useMeetingContext } from '@/contexts/MeetingContext'
import type { PropProps } from '../grid/props/PropRegistry'

function degToEuler(deg: number): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

interface MeetingTableProps extends PropProps {
  /** Whether a meeting is currently in progress */
  meetingActive?: boolean
  /** Called when user clicks the table */
  onTableClick?: () => void
}

export function MeetingTable({
  position,
  rotation,
  meetingActive = false,
  onTableClick,
}: MeetingTableProps) {
  const topToon = useToonMaterialProps(WARM_COLORS.woodLight)
  const legToon = useToonMaterialProps(WARM_COLORS.wood)
  const [hovered, setHovered] = useState(false)
  const glowRef = useRef<THREE.Mesh>(null)
  const activeRingRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()

    // Hover glow
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      if (hovered && !meetingActive) {
        mat.opacity = 0.3 + Math.sin(t * 4) * 0.15
        mat.emissiveIntensity = 0.6 + Math.sin(t * 4) * 0.3
      } else {
        mat.opacity = 0
        mat.emissiveIntensity = 0
      }
    }

    // Active meeting pulse ring
    if (activeRingRef.current) {
      const mat = activeRingRef.current.material as THREE.MeshStandardMaterial
      if (meetingActive) {
        mat.opacity = 0.5 + Math.sin(t * 2) * 0.3
        mat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.4
      } else {
        mat.opacity = 0
      }
    }
  })

  return (
    <group
      position={position}
      rotation={degToEuler(rotation)}
      onClick={(e) => {
        e.stopPropagation()
        if (onTableClick) onTableClick()
      }}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {/* Table top — round disc */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.07, 24]} />
        <meshToonMaterial {...topToon} />
      </mesh>

      {/* Pedestal — central column */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.55, 12]} />
        <meshToonMaterial {...legToon} />
      </mesh>

      {/* Base disc */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.06, 14]} />
        <meshToonMaterial {...legToon} />
      </mesh>

      {/* Hover glow ring (on table surface) */}
      <mesh
        ref={glowRef}
        position={[0, 0.64, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.9, 1.25, 32]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#60a5fa"
          emissiveIntensity={0}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Active meeting indicator ring */}
      <mesh
        ref={activeRingRef}
        position={[0, 0.65, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.0, 1.3, 32]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={0.8}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Tooltip */}
      {hovered && !meetingActive && (
        <Html
          position={[0, 1.2, 0]}
          center
          distanceFactor={12}
          zIndexRange={[10, 15]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            📋 Start Stand-Up Meeting
          </div>
        </Html>
      )}

      {/* Meeting in progress label */}
      {meetingActive && (
        <Html
          position={[0, 1.2, 0]}
          center
          distanceFactor={12}
          zIndexRange={[10, 15]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(22, 163, 74, 0.85)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, sans-serif',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            🔴 Meeting in Progress
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * Prop-registry-compatible wrapper.
 * Reads meeting state from MeetingContext and wires click → dialog.
 */
export function MeetingTableProp(props: PropProps) {
  return <MeetingTableConnected {...props} />
}

function MeetingTableConnected(props: PropProps) {
  const meetingCtx = useMeetingContextSafe()

  const handleClick = () => {
    if (!meetingCtx) return
    if (meetingCtx.meeting.isActive) {
      meetingCtx.showProgress()
    } else {
      meetingCtx.openDialog()
    }
  }

  // Register table position for gathering calculations
  const posX = props.position[0]
  const posZ = props.position[2]
  useEffect(() => {
    meetingCtx?.setTablePosition(posX, posZ)
  }, [meetingCtx, posX, posZ])

  return (
    <MeetingTable
      {...props}
      meetingActive={meetingCtx?.meeting.isActive ?? false}
      onTableClick={handleClick}
    />
  )
}

/** Safe version that returns null when outside MeetingProvider */
function useMeetingContextSafe() {
  try {
    return useMeetingContext()
  } catch {
    return null
  }
}
