import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotChestDisplay } from './BotChestDisplay'
import { BotStatusGlow } from './BotStatusGlow'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { BotVariantConfig } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'
import type { RoomBounds } from './World3DView'

// ─── Global bot position registry (module-level, no React state) ──
// CameraController reads from this to follow bots smoothly.
export const botPositionRegistry = new Map<string, { x: number; y: number; z: number }>()

export type BotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

interface Bot3DProps {
  /** Position in 3D space (bot bottom on floor) */
  position: [number, number, number]
  /** Bot variant config (color, accessory type, etc.) */
  config: BotVariantConfig
  /** Current status */
  status: BotStatus
  /** Display name shown below bot */
  name: string
  /** Scale factor (1.0 = main agent, 0.6 = subagent) */
  scale?: number
  /** Session data (for click handler) */
  session?: CrewSession
  /** Click handler (called in addition to focusBot) */
  onClick?: (session: CrewSession) => void
  /** Room bounds for wandering */
  roomBounds?: RoomBounds
  /** Whether to show the floating name label (controlled by focus level) */
  showLabel?: boolean
  /** Room ID this bot belongs to (for focus navigation) */
  roomId?: string
}

/**
 * Complete 3D bot character — two-primitive stacked design (head + body).
 * Includes body, face, accessory, chest display, status glow,
 * animations, wandering, and floating name tag.
 */
export function Bot3D({ position, config, status, name, scale = 1.0, session, onClick, roomBounds, showLabel = true, roomId }: Bot3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { state: focusState, focusBot } = useWorldFocus()

  // Is THIS bot the one being focused on?
  const isFocused = focusState.level === 'bot' && focusState.focusedBotKey === session?.key

  // ─── Wandering state ──────────────────────────────────────────
  const wanderState = useRef({
    targetX: position[0],
    targetZ: position[2],
    currentX: position[0],
    currentZ: position[2],
    waitTimer: 1 + Math.random() * 3,
    baseX: position[0],
    baseZ: position[2],
    sessionKey: session?.key || '',
  })

  // Update base position when session key changes (bot reassigned to a new spot)
  useEffect(() => {
    const state = wanderState.current
    const newKey = session?.key || ''
    if (state.sessionKey !== newKey) {
      state.baseX = position[0]
      state.baseZ = position[2]
      state.currentX = position[0]
      state.currentZ = position[2]
      state.targetX = position[0]
      state.targetZ = position[2]
      state.waitTimer = 1 + Math.random() * 2
      state.sessionKey = newKey
    }
  }, [session?.key, position])

  // Clean up position registry on unmount
  useEffect(() => {
    const key = session?.key
    return () => {
      if (key) botPositionRegistry.delete(key)
    }
  }, [session?.key])

  // Animations + wandering
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Reset transforms each frame
    groupRef.current.rotation.z = 0
    groupRef.current.rotation.x = 0

    // ─── Status-based animations ──────────────────────────────
    switch (status) {
      case 'active':
        groupRef.current.position.y = position[1] + Math.sin(t * 4) * 0.06
        break
      case 'idle':
        groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.03
        break
      case 'sleeping':
        groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.015
        groupRef.current.rotation.z = 0.12
        groupRef.current.rotation.x = 0.05
        break
      case 'offline':
        groupRef.current.position.y = position[1]
        break
    }

    // ─── Wandering logic ──────────────────────────────────────
    if ((status === 'sleeping' || status === 'offline') || !roomBounds) {
      // No wandering: stay at base position
      groupRef.current.position.x = wanderState.current.baseX
      groupRef.current.position.z = wanderState.current.baseZ
      return
    }

    const state = wanderState.current
    const speed = status === 'active' ? 1.2 : 0.5

    const dx = state.targetX - state.currentX
    const dz = state.targetZ - state.currentZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.15) {
      // Reached target — wait then pick new one
      state.waitTimer -= delta
      if (state.waitTimer <= 0) {
        state.targetX = roomBounds.minX + Math.random() * (roomBounds.maxX - roomBounds.minX)
        state.targetZ = roomBounds.minZ + Math.random() * (roomBounds.maxZ - roomBounds.minZ)
        state.waitTimer = 2 + Math.random() * 4
      }
    } else {
      // Walk toward target
      const step = Math.min(speed * delta, dist)
      state.currentX += (dx / dist) * step
      state.currentZ += (dz / dist) * step
      // Rotate Y toward movement direction
      groupRef.current.rotation.y = Math.atan2(dx, dz)
    }

    groupRef.current.position.x = state.currentX
    groupRef.current.position.z = state.currentZ

    // Update position registry for camera following
    if (session?.key) {
      botPositionRegistry.set(session.key, {
        x: state.currentX,
        y: groupRef.current.position.y,
        z: state.currentZ,
      })
    }
  })

  // Offset y so bot feet rest on the floor
  const yOffset = 0.36

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation()
        if (session && roomId) {
          focusBot(session.key, roomId)
        }
        if (onClick && session) onClick(session)
      }}
      onPointerOver={() => {
        if (session && onClick) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {/* Offset group to put feet on the floor */}
      <group position={[0, yOffset, 0]}>
        {/* Status glow ring (on ground) */}
        <BotStatusGlow status={status} />

        {/* Body (head + body rounded boxes + arms + feet) */}
        <BotBody color={config.color} status={status} />

        {/* Face (eyes + mouth on the head) */}
        <BotFace status={status} expression={config.expression} />

        {/* Chest display (per-type icon/text on body) */}
        <BotChestDisplay type={config.chestDisplay} color={config.color} />

        {/* Accessory (per-type, on top of head) */}
        <BotAccessory type={config.accessory} color={config.color} />

        {/* Sleeping ZZZ text */}
        {status === 'sleeping' && <SleepingZs />}

        {/* Name tag (conditionally shown based on focus level, always shown when focused) */}
        {(showLabel || isFocused) && (
          <Html
            position={[0, -0.55, 0]}
            center
            distanceFactor={15}
            zIndexRange={[1, 5]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// ─── Sleeping ZZZ ──────────────────────────────────────────────

function SleepingZs() {
  const zRefs = useRef<THREE.Group[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    zRefs.current.forEach((ref, i) => {
      if (!ref) return
      const phase = (t * 0.6 + i * 1.2) % 3
      ref.position.y = 0.7 + phase * 0.25
      ref.position.x = Math.sin(t + i) * 0.12
      const opacity = phase < 2.5 ? 0.8 : Math.max(0, 0.8 - (phase - 2.5) * 1.6)
      ref.scale.setScalar(0.5 + phase * 0.12)
      ref.children.forEach(child => {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat && mat.opacity !== undefined) mat.opacity = opacity
      })
    })
  })

  return (
    <group>
      {[0, 1, 2].map(i => (
        <group key={i} ref={el => { if (el) zRefs.current[i] = el }}>
          <Text
            fontSize={0.1}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={0.8}
          >
            Z
          </Text>
        </group>
      ))}
    </group>
  )
}
