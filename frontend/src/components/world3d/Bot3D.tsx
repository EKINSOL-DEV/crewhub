import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotChestDisplay } from './BotChestDisplay'
import { BotStatusGlow } from './BotStatusGlow'
import { BotActivityBubble } from './BotActivityBubble'
import { BotLaptop } from './BotLaptop'
import { SleepingZs, useBotAnimation, tickAnimState, getRoomInteractionPoints, getWalkableCenter } from './BotAnimations'
import { getBlueprintForRoom, getWalkableMask, worldToGrid } from '@/lib/grid'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragActions } from '@/contexts/DragDropContext'
import type { BotVariantConfig } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'
import type { RoomBounds } from './World3DView'

// ─── Cardinal + diagonal directions for random walk ──
const DIRECTIONS = [
  { x: 0, z: -1 },  // N
  { x: 1, z: -1 },  // NE
  { x: 1, z: 0 },   // E
  { x: 1, z: 1 },   // SE
  { x: 0, z: 1 },   // S
  { x: -1, z: 1 },  // SW
  { x: -1, z: 0 },  // W
  { x: -1, z: -1 }, // NW
]

// ─── Fixed Y height for ALL bots ─────────────────────────────────
// Single constant — never calculated from floor geometry or raycasting.
// Feet rest visibly ON TOP of the floor surface (floor top ≈ 0.16).
export const BOT_FIXED_Y = 0.35

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
 * Includes body, face, accessory, chest display, status glow, laptop (when active),
 * animations, wandering, and floating name tag.
 */
export function Bot3D({ position, config, status, name, scale = 1.0, session, onClick, roomBounds, showLabel = true, showActivity = false, activity, isActive = false, roomId, roomName }: Bot3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const walkPhaseRef = useRef(0)
  const wasMovingRef = useRef(false)
  const { state: focusState, focusBot } = useWorldFocus()
  const { startDrag, endDrag } = useDragActions()
  const [hovered, setHovered] = useState(false)

  // 30% size increase for all bots
  const effectiveScale = scale * 1.3

  // Is THIS bot the one being focused on?
  const isFocused = focusState.level === 'bot' && focusState.focusedBotKey === session?.key

  // ─── Grid pathfinding data ─────────────────────────────────────
  const gridData = useMemo(() => {
    if (!roomName) return null
    const blueprint = getBlueprintForRoom(roomName)
    const walkableMask = getWalkableMask(blueprint.cells)
    // Bot-specific mask: door cells are NOT walkable (prevents bots escaping rooms)
    const botWalkableMask = blueprint.cells.map(row =>
      row.map(cell => cell.walkable && cell.type !== 'door')
    )
    return { blueprint, walkableMask, botWalkableMask }
  }, [roomName])

  // ─── Wandering state ──────────────────────────────────────────
  const wanderState = useRef({
    targetX: position[0],
    targetZ: position[2],
    currentX: position[0],
    currentZ: position[2],
    waitTimer: SESSION_CONFIG.wanderMinWaitS + Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS),
    baseX: position[0],
    baseZ: position[2],
    sessionKey: session?.key || '',
    // Random walk state
    dirX: 0,
    dirZ: -1,
    stepsRemaining: 0,
    cellProgress: 0, // 0..1 progress toward next cell center
  })

  // Update base position when session key changes (bot reassigned to a new spot)
  // Also validates spawn position is within room bounds and on a walkable cell
  useEffect(() => {
    const state = wanderState.current
    const newKey = session?.key || ''
    if (state.sessionKey !== newKey) {
      let spawnX = position[0]
      let spawnZ = position[2]

      // Validate spawn position: clamp to room bounds
      if (roomBounds) {
        spawnX = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, spawnX))
        spawnZ = Math.max(roomBounds.minZ, Math.min(roomBounds.maxZ, spawnZ))
      }

      // Validate spawn position: check if it's on a walkable cell (not a door)
      if (gridData && roomBounds) {
        const roomCX = (roomBounds.minX + roomBounds.maxX) / 2
        const roomCZ = (roomBounds.minZ + roomBounds.maxZ) / 2
        const { cellSize, gridWidth, gridDepth } = gridData.blueprint
        const g = worldToGrid(spawnX - roomCX, spawnZ - roomCZ, cellSize, gridWidth, gridDepth)
        const isSpawnWalkable = !!gridData.botWalkableMask[g.z]?.[g.x]
        if (!isSpawnWalkable) {
          // Snap to walkable center
          const wc = gridData.blueprint.walkableCenter
          const [relX, , relZ] = (() => {
            const halfW = (gridWidth * cellSize) / 2
            const halfD = (gridDepth * cellSize) / 2
            const wx = wc.x * cellSize - halfW + cellSize / 2
            const wz = wc.z * cellSize - halfD + cellSize / 2
            return [wx, 0, wz] as [number, number, number]
          })()
          spawnX = roomCX + relX
          spawnZ = roomCZ + relZ
        }
      }

      state.baseX = spawnX
      state.baseZ = spawnZ
      state.currentX = spawnX
      state.currentZ = spawnZ
      state.targetX = spawnX
      state.targetZ = spawnZ
      state.waitTimer = SESSION_CONFIG.wanderMinWaitS + Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS)
      state.sessionKey = newKey
      state.stepsRemaining = 0
      state.cellProgress = 0
    }
  }, [session?.key, position, roomBounds, gridData])

  // Clean up position registry on unmount
  useEffect(() => {
    const key = session?.key
    return () => {
      if (key) botPositionRegistry.delete(key)
    }
  }, [session?.key])

  // ─── Animation state machine ────────────────────────────────
  // Stable serialization of roomBounds to prevent unnecessary recalculation
  const roomBoundsKey = roomBounds
    ? `${roomBounds.minX},${roomBounds.maxX},${roomBounds.minZ},${roomBounds.maxZ}`
    : ''

  const interactionPoints = useMemo(() => {
    if (!roomName || !roomBounds) return null
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
    const roomSize = (roomBounds.maxX - roomBounds.minX) + 5 // re-add margin (2.5 × 2)
    return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, roomBoundsKey])

  const walkableCenter = useMemo(() => {
    if (!roomName || !roomBounds) return null
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
    const roomSize = (roomBounds.maxX - roomBounds.minX) + 5 // re-add margin (2.5 × 2)
    return getWalkableCenter(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, roomBoundsKey])

  const animRef = useBotAnimation(status, interactionPoints, roomBounds)
  const lastAppliedOpacity = useRef(1)
  const materialsClonable = useRef(false) // track if materials have been cloned for this bot
  const hasInitialized = useRef(false) // skip interpolation on first frame

  // Single consolidated useFrame: animation ticks + transforms + movement
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const anim = animRef.current
    const state = wanderState.current

    // ─── First frame: snap to position without interpolation ──
    if (!hasInitialized.current) {
      hasInitialized.current = true
      groupRef.current.position.set(state.currentX, BOT_FIXED_Y, state.currentZ)
      groupRef.current.scale.setScalar(effectiveScale)
      groupRef.current.rotation.set(0, 0, 0)
      if (session?.key) {
        botPositionRegistry.set(session.key, {
          x: state.currentX,
          y: BOT_FIXED_Y,
          z: state.currentZ,
        })
      }
      return
    }

    // ─── Tick animation state machine (phase transitions) ─────
    tickAnimState(anim, delta)

    // ─── Apply animation rotations ────────────────────────────
    groupRef.current.rotation.z = anim.sleepRotZ
    groupRef.current.rotation.x = anim.bodyTilt

    // ─── Save position at frame start (for movement detection after movement) ──
    const frameStartX = state.currentX
    const frameStartZ = state.currentZ

    // ─── Y position: base + animation offset + bounce ─────────
    // Uses wasMovingRef from previous frame (one-frame delay is visually imperceptible)
    const isMovingForBounce = wasMovingRef.current
    let bounceY = 0
    switch (anim.phase) {
      case 'getting-coffee':
      case 'sleeping-walking':
        bounceY = isMovingForBounce ? Math.sin(t * 4) * 0.03 : 0
        break
      case 'idle-wandering':
        // Active bots with laptop get a slightly different bounce
        if (anim.isActiveWalking && !anim.typingPause) {
          bounceY = isMovingForBounce ? Math.sin(t * 3.5) * 0.025 : 0
        } else {
          bounceY = isMovingForBounce ? Math.sin(t * 3) * 0.02 : 0
        }
        break
      case 'sleeping':
        // No position bounce — breathing handled via scale below
        bounceY = 0
        break
      case 'offline':
        bounceY = 0
        break
    }
    groupRef.current.position.y = BOT_FIXED_Y + anim.yOffset + bounceY

    // Breathing effect via scale (sleeping: very slow gentle breathing)
    if (anim.phase === 'sleeping') {
      const breathe = 1 + Math.sin(t * 0.8) * 0.006
      groupRef.current.scale.setScalar(effectiveScale)
      groupRef.current.scale.y = effectiveScale * breathe
    } else {
      groupRef.current.scale.setScalar(effectiveScale)
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
      wasMovingRef.current = false
      walkPhaseRef.current = 0
      return
    }

    // Frozen states (sleeping in corner, coffee break, offline)
    if (anim.freezeWhenArrived && anim.arrived) {
      groupRef.current.position.x = state.currentX
      groupRef.current.position.z = state.currentZ

      // Face toward the target when frozen (coffee machine, sleep corner)
      if (anim.targetX !== null && anim.targetZ !== null) {
        const faceDx = anim.targetX - state.currentX
        const faceDz = anim.targetZ - state.currentZ
        const faceDist = Math.sqrt(faceDx * faceDx + faceDz * faceDz)
        if (faceDist > 0.01) {
          groupRef.current.rotation.y = Math.atan2(faceDx, faceDz)
        }
      }

      if (session?.key) {
        botPositionRegistry.set(session.key, {
          x: state.currentX,
          y: groupRef.current.position.y,
          z: state.currentZ,
        })
      }
      wasMovingRef.current = false
      walkPhaseRef.current = 0
      return
    }

    const speed = anim.walkSpeed || 0.5
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2

    // Helper: check if a world position is walkable on the grid (doors blocked for bots)
    const isWalkableAt = (wx: number, wz: number): boolean => {
      if (!gridData) return true // No grid = open area, always walkable
      // Hard room bounds check first — reject anything outside room bounds
      if (wx < roomBounds.minX || wx > roomBounds.maxX || wz < roomBounds.minZ || wz > roomBounds.maxZ) {
        return false
      }
      const { cellSize, gridWidth, gridDepth } = gridData.blueprint
      const g = worldToGrid(wx - roomCenterX, wz - roomCenterZ, cellSize, gridWidth, gridDepth)
      return !!gridData.botWalkableMask[g.z]?.[g.x]
    }

    // Helper: pick a random walkable direction from current position
    const pickWalkableDir = (): { x: number; z: number } | null => {
      const cellSize = gridData ? gridData.blueprint.cellSize : 1.0
      const shuffled = [...DIRECTIONS].sort(() => Math.random() - 0.5)
      for (const d of shuffled) {
        if (isWalkableAt(state.currentX + d.x * cellSize, state.currentZ + d.z * cellSize)) {
          return d
        }
      }
      return null // Completely boxed in (shouldn't happen)
    }

    if (anim.resetWanderTarget) {
      state.stepsRemaining = 0
      state.waitTimer = 0.5
      anim.resetWanderTarget = false
    }

    // Override wander target from animation system (coffee, sleep)
    const hasAnimTarget = anim.targetX !== null && anim.targetZ !== null
    if (hasAnimTarget) {
      state.targetX = anim.targetX!
      state.targetZ = anim.targetZ!
    }

    if (!gridData) {
      // ─── No grid (parking bots) — direct circular wander ────
      const wc = walkableCenter
      const dx = state.targetX - state.currentX
      const dz = state.targetZ - state.currentZ
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 0.4) {
        if (hasAnimTarget && !anim.arrived) {
          anim.arrived = true
          if (anim.freezeWhenArrived) {
            groupRef.current.position.x = state.currentX
            groupRef.current.position.z = state.currentZ
            if (session?.key) {
              botPositionRegistry.set(session.key, {
                x: state.currentX, y: groupRef.current.position.y, z: state.currentZ,
              })
            }
            return
          }
        }
        state.waitTimer -= delta
        if (state.waitTimer <= 0 && !hasAnimTarget) {
          if (wc) {
            const angle = Math.random() * Math.PI * 2
            const r = Math.sqrt(Math.random()) * wc.radius
            state.targetX = wc.x + Math.cos(angle) * r
            state.targetZ = wc.z + Math.sin(angle) * r
          } else {
            state.targetX = roomCenterX + (Math.random() - 0.5) * 2
            state.targetZ = roomCenterZ + (Math.random() - 0.5) * 2
          }
          state.waitTimer = SESSION_CONFIG.wanderMinWaitS + Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS)
        }
      } else {
        // Skip movement if in typing pause
        if (!anim.typingPause) {
          const easedSpeed = speed * Math.min(1, dist / 0.5)
          const step = Math.min(easedSpeed * delta, dist)
          state.currentX += (dx / dist) * step
          state.currentZ += (dz / dist) * step
        }
        const targetRotY = Math.atan2(dx, dz)
        const currentRotY = groupRef.current.rotation.y
        let angleDiff = targetRotY - currentRotY
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        // Rotation dead-zone snap [Fix 6]
        if (Math.abs(angleDiff) < 0.01) {
          groupRef.current.rotation.y = targetRotY
        } else {
          groupRef.current.rotation.y = currentRotY + angleDiff * 0.2
        }
      }
    } else if (hasAnimTarget && !anim.arrived) {
      // ─── Walking toward animation target (coffee/sleep) ──
      const dx = state.targetX - state.currentX
      const dz = state.targetZ - state.currentZ
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 0.4) {
        anim.arrived = true
        if (anim.freezeWhenArrived) {
          groupRef.current.position.x = state.currentX
          groupRef.current.position.z = state.currentZ
          if (session?.key) {
            botPositionRegistry.set(session.key, {
              x: state.currentX, y: groupRef.current.position.y, z: state.currentZ,
            })
          }
          return
        }
      } else {
        if (dist < 0.8) {
          // Close to target — direct linear movement (no grid snapping) [Fix 3]
          const easedSpeed = speed * Math.min(1, dist / 0.5)
          const step = Math.min(easedSpeed * delta, dist)
          state.currentX += (dx / dist) * step
          state.currentZ += (dz / dist) * step
        } else {
          // Far from target — grid-snapped direction picking
          const cellSize = gridData.blueprint.cellSize
          const ndx = dx / dist
          const ndz = dz / dist

          // Score each direction by dot product with target direction, pick best walkable
          let bestDir: { x: number; z: number } | null = null
          let bestScore = -Infinity
          for (const d of DIRECTIONS) {
            const nextX = state.currentX + d.x * cellSize
            const nextZ = state.currentZ + d.z * cellSize
            if (!isWalkableAt(nextX, nextZ)) continue
            const score = d.x * ndx + d.z * ndz // dot product
            if (score > bestScore) {
              bestScore = score
              bestDir = d
            }
          }

          if (bestDir) {
            const easedSpeed = speed * Math.min(1, dist / 0.5)
            const step = Math.min(easedSpeed * delta, dist)
            // Normalize diagonal movement vectors [Fix 5]
            const dirMag = Math.sqrt(bestDir.x * bestDir.x + bestDir.z * bestDir.z)
            state.currentX += (bestDir.x / dirMag) * step
            state.currentZ += (bestDir.z / dirMag) * step
          }
        }

        // Smooth rotation toward target
        const targetRotY = Math.atan2(dx, dz)
        const currentRotY = groupRef.current.rotation.y
        let angleDiff = targetRotY - currentRotY
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
        // Rotation dead-zone snap [Fix 6]
        if (Math.abs(angleDiff) < 0.01) {
          groupRef.current.rotation.y = targetRotY
        } else {
          groupRef.current.rotation.y = currentRotY + angleDiff * 0.18
        }
      }
    } else {
      // ─── Random walk with obstacle avoidance ───────────────
      // Typing pause — active bot pauses briefly as if typing on laptop
      if (anim.typingPause) {
        // Stay in place, don't modify currentX/currentZ
        // Still rotate toward current direction while paused
        if (state.stepsRemaining > 0) {
          const targetRotY = Math.atan2(state.dirX, state.dirZ)
          const currentRotY = groupRef.current.rotation.y
          let angleDiff = targetRotY - currentRotY
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
          if (Math.abs(angleDiff) < 0.01) {
            groupRef.current.rotation.y = targetRotY
          } else {
            groupRef.current.rotation.y = currentRotY + angleDiff * 0.15
          }
        }
      } else {
        const cellSize = gridData.blueprint.cellSize

        // Wait phase
        if (state.waitTimer > 0) {
          state.waitTimer -= delta
          // Still rotate toward current direction while waiting
          if (state.stepsRemaining > 0) {
            const targetRotY = Math.atan2(state.dirX, state.dirZ)
            const currentRotY = groupRef.current.rotation.y
            let angleDiff = targetRotY - currentRotY
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
            // Rotation dead-zone snap [Fix 6]
            if (Math.abs(angleDiff) < 0.01) {
              groupRef.current.rotation.y = targetRotY
            } else {
              groupRef.current.rotation.y = currentRotY + angleDiff * 0.15
            }
          }
        } else if (state.stepsRemaining <= 0) {
          // Pick a new random direction and number of steps
          const dir = pickWalkableDir()
          if (dir) {
            state.dirX = dir.x
            state.dirZ = dir.z
            state.stepsRemaining = SESSION_CONFIG.wanderMinSteps + Math.floor(Math.random() * (SESSION_CONFIG.wanderMaxSteps - SESSION_CONFIG.wanderMinSteps + 1))
            state.cellProgress = 0
            state.waitTimer = 1 + Math.random() * 2 // pause 1-3s before walking
          } else {
            state.waitTimer = 1 // boxed in, wait and retry
          }
        } else {
          // Walking phase — move forward one cell at a time
          const nextWorldX = state.currentX + state.dirX * cellSize
          const nextWorldZ = state.currentZ + state.dirZ * cellSize

          if (!isWalkableAt(nextWorldX, nextWorldZ)) {
            // Obstacle ahead — pick a new walkable direction
            const dir = pickWalkableDir()
            if (dir) {
              state.dirX = dir.x
              state.dirZ = dir.z
              state.stepsRemaining = Math.max(2, SESSION_CONFIG.wanderMinSteps - 1) + Math.floor(Math.random() * (SESSION_CONFIG.wanderMaxSteps - SESSION_CONFIG.wanderMinSteps))
              state.cellProgress = 0
            }
            state.waitTimer = 0.5 // brief pause after redirect
          } else {
            // Move toward next cell center
            const step = speed * delta
            state.cellProgress += step / cellSize

            // Normalize diagonal movement vectors [Fix 5]
            const dirMag = Math.sqrt(state.dirX * state.dirX + state.dirZ * state.dirZ)
            if (dirMag > 0) {
              state.currentX += (state.dirX / dirMag) * step
              state.currentZ += (state.dirZ / dirMag) * step
            }

            // When we've traversed one cell width, count it
            if (state.cellProgress >= 1) {
              state.stepsRemaining--
              state.cellProgress = 0
            }

            // Smooth rotation toward movement direction
            const targetRotY = Math.atan2(state.dirX, state.dirZ)
            const currentRotY = groupRef.current.rotation.y
            let angleDiff = targetRotY - currentRotY
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
            // Rotation dead-zone snap [Fix 6]
            if (Math.abs(angleDiff) < 0.01) {
              groupRef.current.rotation.y = targetRotY
            } else {
              groupRef.current.rotation.y = currentRotY + angleDiff * 0.18
            }
          }
        }
      }
    }

    // ─── Hard clamp to room bounds (safety net) ─────────────────
    if (roomBounds) {
      state.currentX = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, state.currentX))
      state.currentZ = Math.max(roomBounds.minZ, Math.min(roomBounds.maxZ, state.currentZ))
    }

    // ─── Detect movement for walk animation ──────────────────────
    const frameDx = state.currentX - frameStartX
    const frameDz = state.currentZ - frameStartZ
    const frameDist = Math.sqrt(frameDx * frameDx + frameDz * frameDz)
    const isMovingNow = frameDist > 0.001
    wasMovingRef.current = isMovingNow

    // Update walk phase for foot/arm animation
    if (isMovingNow) {
      walkPhaseRef.current += delta * 8 // walk cycle speed
    } else {
      // Smoothly decay walk phase to 0 (legs return to rest)
      walkPhaseRef.current *= 0.85
      if (Math.abs(walkPhaseRef.current) < 0.01) walkPhaseRef.current = 0
    }

    groupRef.current.position.x = state.currentX
    groupRef.current.position.z = state.currentZ

    // ─── Prevent tilt: lock rotation to Y-axis only ───────────
    // Animation may set rotation.x (bodyTilt) and rotation.z (sleepRotZ)
    // Allow bodyTilt during typing pauses (looking at laptop) and sleeping.
    if (anim.phase === 'sleeping') {
      // Sleep: both bodyTilt and sleepRotZ are applied (set by animation)
    } else {
      // Allow intentional body tilt (e.g., typing pause looking at laptop)
      groupRef.current.rotation.x = anim.bodyTilt || 0
      groupRef.current.rotation.z = 0
    }

    // Update position registry for camera following
    if (session?.key) {
      botPositionRegistry.set(session.key, {
        x: state.currentX,
        y: groupRef.current.position.y,
        z: state.currentZ,
      })
    }
  })

  // Offset y so bot feet rest on the floor.
  // Bot feet bottom is at y=-0.33 in body space; offset of 0.33 puts feet
  // at the group origin.  Combined with BOT_FIXED_Y (0.35), the fixed
  // constant height, this ensures feet sit visibly on top of the floor surface.
  const yOffset = 0.33

  return (
    <group
      ref={groupRef}
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
        <BotBody color={config.color} status={status} walkPhaseRef={walkPhaseRef} />

        {/* Face (eyes + mouth on the head) */}
        <BotFace status={status} expression={config.expression} />

        {/* Chest display (per-type icon/text on body) */}
        <BotChestDisplay type={config.chestDisplay} color={config.color} />

        {/* Accessory (per-type, on top of head) */}
        <BotAccessory type={config.accessory} color={config.color} />

        {/* Floating laptop (visible when bot is actively working) */}
        <BotLaptop visible={status === 'active'} />

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
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', session.key)
                e.dataTransfer.effectAllowed = 'move'
                // Create a styled drag ghost
                const ghost = document.createElement('div')
                ghost.textContent = `🤖 ${name}`
                ghost.style.cssText = `
                  position: fixed; top: -200px; left: -200px;
                  background: linear-gradient(135deg, ${config.color}dd, ${config.color}99);
                  color: #fff; padding: 6px 14px; border-radius: 10px;
                  font-size: 13px; font-family: system-ui, sans-serif;
                  font-weight: 600; white-space: nowrap;
                  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                  border: 2px solid rgba(255,255,255,0.3);
                `
                document.body.appendChild(ghost)
                e.dataTransfer.setDragImage(ghost, 40, 16)
                // Clean up ghost after drag starts
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    if (document.body.contains(ghost)) document.body.removeChild(ghost)
                  }, 100)
                })
                startDrag(session.key, name, roomId)
              }}
              onDragEnd={() => endDrag()}
              style={{
                cursor: 'grab',
                padding: '3px 8px',
                fontSize: '13px',
                background: 'rgba(0,0,0,0.6)',
                borderRadius: '8px',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.2s ease',
                userSelect: 'none',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(4px)',
              }}
              title="Drag to move to another room"
            >
              <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>✋</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', fontFamily: 'system-ui, sans-serif' }}>move</span>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// SleepingZs moved to BotAnimations.tsx
