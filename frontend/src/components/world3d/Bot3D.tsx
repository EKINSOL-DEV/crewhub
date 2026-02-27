import { useRef, useEffect, useMemo, useState, memo } from 'react'
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
import { SleepingZs, useBotAnimation } from './BotAnimations'
import { BotSpeechBubble } from './BotSpeechBubble'
import { meetingGatheringState } from '@/lib/meetingStore'
import { tickAnimState } from './botAnimTick'
import { getRoomInteractionPoints, getWalkableCenter } from './roomInteractionPoints'
import { getBlueprintForRoom, getWalkableMask, worldToGrid } from '@/lib/grid'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useDragActions } from '@/contexts/DragDropContext'
import type { BotVariantConfig } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'
import type { RoomBounds } from './World3DView'

import {
  smoothRotateY,
  calculateBounceY,
  applyOpacity,
  handleMeetingMovement,
  handleNoGridWander,
  handleAnimTargetWalk,
  handleRandomGridWalk,
} from './botMovement'

import { BOT_FIXED_Y, botPositionRegistry } from './botConstants'
import type { BotStatus } from './botConstants'

interface Bot3DProps {
  /** Position in 3D space (bot bottom on floor) */
  readonly position: [number, number, number]
  /** Bot variant config (color, accessory type, etc.) */
  readonly config: BotVariantConfig
  /** Current status */
  readonly status: BotStatus
  /** Display name shown below bot */
  readonly name: string
  /** Scale factor (1 = main agent, 0.6 = subagent) */
  readonly scale?: number
  /** Session data (for click handler) */
  readonly session?: CrewSession
  /** Click handler (called in addition to focusBot) */
  readonly onClick?: (session: CrewSession) => void
  /** Room bounds for wandering */
  readonly roomBounds?: RoomBounds
  /** Whether to show the floating name label (controlled by focus level) */
  readonly showLabel?: boolean
  /** Whether to show the activity bubble above the bot */
  readonly showActivity?: boolean
  /** Current activity text (e.g. "🔧 web_search", "Working...", "💤 Idle") */
  readonly activity?: string
  /** Whether the bot is actively running (tokens changing in last 30s) */
  readonly isActive?: boolean
  /** Room ID this bot belongs to (for focus navigation) */
  readonly roomId?: string
  /** Room name (for determining furniture interaction points) */
  readonly roomName?: string
}

/**
 * Complete 3D bot character — two-primitive stacked design (head + body).
 * Includes body, face, accessory, chest display, status glow, laptop (when active),
 * animations, wandering, and floating name tag.
 */
export const Bot3D = memo(function Bot3D({
  position,
  config,
  status,
  name,
  scale = 1,
  session,
  onClick,
  roomBounds,
  showLabel = true,
  showActivity = false,
  activity,
  isActive = false,
  roomId,
  roomName,
}: Bot3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const walkPhaseRef = useRef(0)
  const wasMovingRef = useRef(false)
  const { state: focusState, focusBot } = useWorldFocus()
  const { startDrag: _startDrag, endDrag: _endDrag } = useDragActions()
  const [_hovered, setHovered] = useState(false) // NOSONAR
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Demo mode: disable drag functionality
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

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
    const botWalkableMask = blueprint.cells.map((row) =>
      row.map((cell) => cell.walkable && cell.type !== 'door')
    )
    return { blueprint, walkableMask, botWalkableMask }
  }, [roomName])

  // ─── Wandering state ──────────────────────────────────────────
  const wanderState = useRef({
    targetX: position[0],
    targetZ: position[2],
    currentX: position[0],
    currentZ: position[2],
    waitTimer:
      SESSION_CONFIG.wanderMinWaitS +
      Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS),
    baseX: position[0],
    baseZ: position[2],
    sessionKey: session?.key || '',
    // Random walk state
    dirX: 0,
    dirZ: -1,
    stepsRemaining: 0,
    cellProgress: 0, // 0..1 progress toward next cell center
    // Meeting pathfinding waypoints
    meetingWaypoints: [] as { x: number; z: number }[],
    meetingWaypointIndex: 0,
    meetingPathComputed: false,
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
      state.waitTimer =
        SESSION_CONFIG.wanderMinWaitS +
        Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS)
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
    const roomSize = roomBounds.maxX - roomBounds.minX + 5 // re-add margin (2.5 × 2)
    return getRoomInteractionPoints(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, roomBoundsKey])

  const walkableCenter = useMemo(() => {
    if (!roomName || !roomBounds) return null
    const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2
    const roomCenterZ = (roomBounds.minZ + roomBounds.maxZ) / 2
    const roomSize = roomBounds.maxX - roomBounds.minX + 5 // re-add margin (2.5 × 2)
    return getWalkableCenter(roomName, roomSize, [roomCenterX, 0, roomCenterZ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, roomBoundsKey])

  const animRef = useBotAnimation(status, interactionPoints, roomBounds)
  const lastAppliedOpacity = useRef(1)
  const materialsClonable = useRef(false) // track if materials have been cloned for this bot
  const hasInitialized = useRef(false) // skip interpolation on first frame

  // Single consolidated useFrame: animation ticks + transforms + movement
  /* NOSONAR */ useFrame(({ clock }, delta) => {
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
    const bounceY = calculateBounceY(
      anim.phase,
      wasMovingRef.current,
      anim.isActiveWalking,
      anim.typingPause,
      t
    )
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
      applyOpacity(groupRef.current, anim.opacity, materialsClonable)
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

    // ─── Meeting gathering override (with waypoint pathfinding) ──
    if (
      handleMeetingMovement(
        groupRef.current,
        state,
        session?.key,
        delta,
        frameStartX,
        frameStartZ,
        wasMovingRef,
        walkPhaseRef
      )
    ) {
      return // Skip normal wandering
    }

    // Frozen states (sleeping in corner, coffee break, offline)
    if (anim.freezeWhenArrived && anim.arrived) {
      groupRef.current.position.x = state.currentX
      groupRef.current.position.z = state.currentZ

      // Face toward the target when frozen (coffee machine, sleep corner)
      if (anim.targetX !== null && anim.targetZ !== null) {
        const faceDx = anim.targetX - state.currentX
        const faceDz = anim.targetZ - state.currentZ
        const faceDist = Math.hypot(faceDx, faceDz)
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
      // No grid (parking bots) — direct circular wander
      const freeze = handleNoGridWander(
        groupRef.current,
        state,
        anim,
        hasAnimTarget,
        walkableCenter,
        roomCenterX,
        roomCenterZ,
        speed,
        delta,
        session?.key
      )
      if (freeze) return
    } else if (hasAnimTarget && !anim.arrived) {
      // Walking toward animation target (coffee/sleep)
      handleAnimTargetWalk(groupRef.current, state, anim, gridData, roomBounds, {
        roomCenterX,
        roomCenterZ,
        speed,
        delta,
        sessionKey: session?.key,
      })
      if (anim.arrived && anim.freezeWhenArrived) return
    } else if (anim.typingPause) {
      // Typing pause: stay in place, keep rotating toward direction
      if (state.stepsRemaining > 0) {
        smoothRotateY(groupRef.current, Math.atan2(state.dirX, state.dirZ), 0.15)
      }
    } else {
      // Random walk with obstacle avoidance
      handleRandomGridWalk(groupRef.current, state, gridData, roomBounds, {
        roomCenterX,
        roomCenterZ,
        speed,
        delta,
      })
    }

    // ─── Hard clamp to room bounds (safety net) ─────────────────
    if (roomBounds) {
      state.currentX = Math.max(roomBounds.minX, Math.min(roomBounds.maxX, state.currentX))
      state.currentZ = Math.max(roomBounds.minZ, Math.min(roomBounds.maxZ, state.currentZ))
    }

    // ─── Detect movement for walk animation ──────────────────────
    const frameDx = state.currentX - frameStartX
    const frameDz = state.currentZ - frameStartZ
    const frameDist = Math.hypot(frameDx, frameDz)
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
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = null
        }
        setHovered(true)
        // Don't show grab cursor in demo mode (drag doesn't work properly)
        if (session && onClick && !isDemoMode) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        // Delay unhover so user can reach the drag handle
        hoverTimeoutRef.current = setTimeout(() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }, 400)
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
        <BotLaptop visible={status === 'active' || status === 'supervising'} />

        {/* Sleeping ZZZ (visibility controlled by animRef.showZzz, not raw status) */}
        {status === 'sleeping' && <SleepingZs animRef={animRef} />}

        {/* Activity bubble (above head) */}
        {showActivity && activity && status !== 'sleeping' && status !== 'offline' && (
          <BotActivityBubble activity={activity} status={status} isActive={isActive} />
        )}

        {/* Meeting: Speech bubble above active speaker */}
        {session?.key &&
          meetingGatheringState.active &&
          meetingGatheringState.activeSpeaker === session.key &&
          meetingGatheringState.activeSpeakerText && (
            <BotSpeechBubble text={meetingGatheringState.activeSpeakerText} />
          )}

        {/* Meeting: Completed turn checkmark */}
        {session?.key &&
          meetingGatheringState.active &&
          meetingGatheringState.completedTurns.has(session.key) &&
          meetingGatheringState.activeSpeaker !== session.key && (
            <Html
              position={[0, 1.2, 0]}
              center
              distanceFactor={10}
              zIndexRange={[5, 10]}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{ fontSize: '16px', opacity: 0.8 }}>✓</div>
            </Html>
          )}

        {/* Meeting: Active speaker glow ring */}
        {session?.key &&
          meetingGatheringState.active &&
          meetingGatheringState.activeSpeaker === session.key && (
            <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.28, 0.42, 24]} />
              <meshStandardMaterial
                color="#60a5fa"
                emissive="#60a5fa"
                emissiveIntensity={1.2}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}

        {/* Name tag (conditionally shown based on focus level, always shown when focused) */}
        {/* Hidden for spawned agents (subagents) — activity bubble already shows their task */}
        {(showLabel || isFocused) && !session?.key?.includes(':subagent:') && (
          <Html
            position={[0, -0.55, 0]}
            center
            distanceFactor={15}
            zIndexRange={[0, 0]}
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

        {/* Drag handle removed - using "Move to room" button in BotInfoPanel instead */}
      </group>
    </group>
  )
})

// SleepingZs moved to BotAnimations.tsx
