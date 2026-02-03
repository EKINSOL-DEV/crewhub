import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotChestDisplay } from './BotChestDisplay'
import { BotStatusGlow } from './BotStatusGlow'
import { BotActivityBubble } from './BotActivityBubble'
import { SleepingZs, useBotAnimation, tickAnimState, getRoomInteractionPoints, getWalkableCenter } from './BotAnimations'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragActions } from '@/contexts/DragDropContext'
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
  /** Whether to show the activity bubble above the bot */
  showActivity?: boolean
  /** Current activity text (e.g. "🔧 web_search", "Working...", "💤 Idle") */
  activity?: string
  /** Whether the bot is actively running (tokens changing in last 30s) */
  isActive?: boolean
  /** Room ID this bot belongs to (for focus navigation) */
  roomId?: string
  /** Room name (for determining furniture interaction points) */
  roomName?: string
}

/**
 * Complete 3D bot character — two-primitive stacked design (head + body).
 * Includes body, face, accessory, chest display, status glow,
 * animations, wandering, and floating name tag.
 */
export function Bot3D({ position, config, status, name, scale = 1.0, session, onClick, roomBounds, showLabel = true, showActivity = false, activity, isActive = false, roomId, roomName }: Bot3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { state: focusState, focusBot } = useWorldFocus()
  const { startDrag, endDrag } = useDragActions()
  const [hovered, setHovered] = useState(false)

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

  // ─── Animation state machine ────────────────────────────────
  const interactionPoints = useMemo(() => {
    if (!roomName || !roomBounds) return null
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
    const roomSize = (roomBounds.maxX - roomBounds.minX) + 5 // re-add margin (2.5 × 2)
    return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
  }, [roomName, roomBounds])

  const walkableCenter = useMemo(() => {
    if (!roomName || !roomBounds) return null
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
    const roomSize = (roomBounds.maxX - roomBounds.minX) + 5 // re-add margin (2.5 × 2)
    return getWalkableCenter(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
  }, [roomName, roomBounds])

  const animRef = useBotAnimation(status, interactionPoints, roomBounds)
  const lastAppliedOpacity = useRef(1)
  const materialsClonable = useRef(false) // track if materials have been cloned for this bot

  // Single consolidated useFrame: animation ticks + transforms + movement
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const anim = animRef.current
    const state = wanderState.current

    // ─── Tick animation state machine (phase transitions) ─────
    tickAnimState(anim, delta)

    // ─── Apply animation rotations ────────────────────────────
    groupRef.current.rotation.z = anim.sleepRotZ
    groupRef.current.rotation.x = anim.bodyTilt

    // ─── Y position: base + animation offset + bounce ─────────
    // Only bounce when actually moving (dist > threshold)
    const moveDist = Math.sqrt(
      (state.targetX - state.currentX) ** 2 + (state.targetZ - state.currentZ) ** 2
    )
    const isMoving = moveDist > 0.3
    let bounceY = 0
    switch (anim.phase) {
      case 'working':
        // Almost imperceptible head bob when working
        bounceY = anim.headBob ? Math.sin(t * 2) * 0.004 : 0
        break
      case 'walking-to-desk':
      case 'getting-coffee':
      case 'sleeping-walking':
        bounceY = isMoving ? Math.sin(t * 4) * 0.03 : 0
        break
      case 'idle-wandering':
        bounceY = isMoving ? Math.sin(t * 3) * 0.02 : 0
        break
      case 'sleeping':
        // No position bounce — breathing handled via scale below
        bounceY = 0
        break
      case 'offline':
        bounceY = 0
        break
    }
    groupRef.current.position.y = position[1] + anim.yOffset + bounceY

    // Breathing effect via scale (sleeping: very slow gentle breathing)
    if (anim.phase === 'sleeping') {
      const breathe = 1 + Math.sin(t * 0.8) * 0.006
      groupRef.current.scale.setScalar(scale)
      groupRef.current.scale.y = scale * breathe
    } else {
      groupRef.current.scale.setScalar(scale)
    }

    // ─── Apply opacity (only on change, with cloned materials) ─
    if (anim.opacity !== lastAppliedOpacity.current) {
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          // Clone materials on first opacity change to avoid shared-material side effects
          if (!materialsClonable.current) {
            if (Array.isArray(mesh.material)) {
              mesh.material = (mesh.material as THREE.Material[]).map(m => m.clone())
            } else {
              mesh.material = (mesh.material as THREE.Material).clone()
            }
          }
          const mats = Array.isArray(mesh.material)
            ? mesh.material as THREE.Material[]
            : [mesh.material as THREE.Material]
          for (const mat of mats) {
            if ('opacity' in mat) {
              mat.transparent = anim.opacity < 1
              mat.opacity = anim.opacity
            }
          }
        }
      })
      materialsClonable.current = true
      lastAppliedOpacity.current = anim.opacity
    }

    // ─── Movement logic ───────────────────────────────────────
    if (!roomBounds) {
      // No bounds — stay at base position
      groupRef.current.position.x = state.baseX
      groupRef.current.position.z = state.baseZ
      return
    }

    // Frozen states (working at desk, sleeping in corner, offline)
    if (anim.freezeWhenArrived && anim.arrived) {
      groupRef.current.position.x = state.currentX
      groupRef.current.position.z = state.currentZ
      if (session?.key) {
        botPositionRegistry.set(session.key, {
          x: state.currentX,
          y: groupRef.current.position.y,
          z: state.currentZ,
        })
      }
      return
    }

    // Pick random wander target within safe walkable zone (circular area in room center)
    const wc = walkableCenter
    const pickWanderTarget = () => {
      if (wc) {
        const angle = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * wc.radius // sqrt for uniform area distribution
        return { x: wc.x + Math.cos(angle) * r, z: wc.z + Math.sin(angle) * r }
      }
      // Fallback: center of room bounds
      return {
        x: (roomBounds.minX + roomBounds.maxX) / 2,
        z: (roomBounds.minZ + roomBounds.maxZ) / 2,
      }
    }

    if (anim.resetWanderTarget) {
      const target = pickWanderTarget()
      state.targetX = target.x
      state.targetZ = target.z
      state.waitTimer = 0.5
      anim.resetWanderTarget = false
    }

    // Override wander target from animation system
    if (anim.targetX !== null && anim.targetZ !== null) {
      state.targetX = anim.targetX
      state.targetZ = anim.targetZ
    }

    const speed = anim.walkSpeed || 0.5
    const dx = state.targetX - state.currentX
    const dz = state.targetZ - state.currentZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.3) {
      // Check if this was an animation target
      if (anim.targetX !== null && anim.targetZ !== null && !anim.arrived) {
        anim.arrived = true
        if (anim.freezeWhenArrived) {
          groupRef.current.position.x = state.currentX
          groupRef.current.position.z = state.currentZ
          if (session?.key) {
            botPositionRegistry.set(session.key, {
              x: state.currentX,
              y: groupRef.current.position.y,
              z: state.currentZ,
            })
          }
          return
        }
      }

      // Random wandering: wait then pick new target within walkable zone
      state.waitTimer -= delta
      if (state.waitTimer <= 0 && anim.targetX === null) {
        const target = pickWanderTarget()
        state.targetX = target.x
        state.targetZ = target.z
        state.waitTimer = 3 + Math.random() * 3 // 3-6 seconds between wanders
      }
    } else {
      // Walk toward target with eased speed (slow down near target)
      const easedSpeed = speed * Math.min(1, dist / 1.0)
      const step = Math.min(easedSpeed * delta, dist)
      state.currentX += (dx / dist) * step
      state.currentZ += (dz / dist) * step

      // Lerp rotation for smooth turning (shortest path)
      const targetRotY = Math.atan2(dx, dz)
      const currentRotY = groupRef.current.rotation.y
      let angleDiff = targetRotY - currentRotY
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      groupRef.current.rotation.y = currentRotY + angleDiff * 0.1
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
        setHovered(true)
        if (session && onClick) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
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

        {/* Sleeping ZZZ (visibility controlled by animRef.showZzz, not raw status) */}
        {status === 'sleeping' && <SleepingZs animRef={animRef} />}

        {/* Activity bubble (above head) */}
        {showActivity && activity && status !== 'sleeping' && status !== 'offline' && (
          <BotActivityBubble
            activity={activity}
            status={status}
            isActive={isActive}
          />
        )}

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

        {/* Drag handle (visible on hover) */}
        {session && roomId && (
          <Html
            position={[0, 0.95, 0]}
            center
            distanceFactor={15}
            zIndexRange={[10, 20]}
            style={{ pointerEvents: hovered ? 'auto' : 'none' }}
          >
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', session.key)
                e.dataTransfer.effectAllowed = 'move'
                // Create a small drag image
                const ghost = document.createElement('div')
                ghost.textContent = `🤖 ${name}`
                ghost.style.cssText = 'position:fixed;top:-100px;left:-100px;background:rgba(0,0,0,0.8);color:#fff;padding:4px 10px;border-radius:8px;font-size:12px;font-family:system-ui,sans-serif;white-space:nowrap;'
                document.body.appendChild(ghost)
                e.dataTransfer.setDragImage(ghost, 0, 0)
                // Clean up ghost after a tick
                requestAnimationFrame(() => document.body.removeChild(ghost))
                startDrag(session.key, name, roomId)
              }}
              onDragEnd={() => endDrag()}
              style={{
                cursor: 'grab',
                padding: '2px 6px',
                fontSize: '13px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '6px',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.2s ease',
                userSelect: 'none',
                lineHeight: 1,
              }}
              title="Drag to move to another room"
            >
              <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>✋</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// SleepingZs moved to BotAnimations.tsx

