import { useRef, useMemo, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotChestDisplay } from './BotChestDisplay'
import { BotStatusGlow } from './BotStatusGlow'
import { SleepingZs, type AnimState } from './BotAnimations'
import { getBotConfigFromSession } from './utils/botVariants'
import { getSessionDisplayName } from '@/lib/minionUtils'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import type { BotVariantConfig } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'

// ─── Outdoor Wandering Constants ─────────────────────────────────

/** How many bots wander outside at once */
const MIN_WANDERERS = 3
const MAX_WANDERERS = 6
/** How often to refresh which bots are wandering (ms) */
const REFRESH_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes
/** Walk speed for outdoor wanderers (slow, casual) */
const OUTDOOR_WALK_SPEED = 0.3
/** Pause between wander moves (seconds) */
const PAUSE_MIN_S = 3
const PAUSE_MAX_S = 8

// ─── Types ───────────────────────────────────────────────────────

interface WanderState {
  currentX: number
  currentZ: number
  targetX: number
  targetZ: number
  waitTimer: number
  rotY: number
}

interface WanderingBots3DProps {
  /** All sleeping/parked sessions to pick wanderers from */
  sleepingSessions: CrewSession[]
  /** Display names map */
  displayNames: Map<string, string | null>
  /** Building dimensions to determine outdoor area */
  buildingWidth: number
  buildingDepth: number
  /** On bot click handler */
  onBotClick?: (session: CrewSession) => void
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Get a random point in the outdoor area (outside the building, on the grass) */
function getRandomOutdoorPosition(buildingWidth: number, buildingDepth: number): [number, number] {
  const halfBW = buildingWidth / 2
  const halfBD = buildingDepth / 2
  const margin = 3 // Stay away from building walls
  const outerRange = 25 // How far out from building bots can roam

  // Pick a random zone: front, back, left, or right of building
  const zone = Math.floor(Math.random() * 4)
  let x: number, z: number

  switch (zone) {
    case 0: // Front (negative Z)
      x = (Math.random() - 0.5) * (buildingWidth + outerRange * 2)
      z = -halfBD - margin - Math.random() * outerRange
      break
    case 1: // Back (positive Z)
      x = (Math.random() - 0.5) * (buildingWidth + outerRange * 2)
      z = halfBD + margin + Math.random() * outerRange
      break
    case 2: // Left (negative X)
      x = -halfBW - margin - Math.random() * outerRange
      z = (Math.random() - 0.5) * (buildingDepth + outerRange * 2)
      break
    case 3: // Right (positive X)
    default:
      x = halfBW + margin + Math.random() * outerRange
      z = (Math.random() - 0.5) * (buildingDepth + outerRange * 2)
      break
  }

  return [x, z]
}

// ─── Single Wandering Bot Component ──────────────────────────────

interface OutdoorBotProps {
  session: CrewSession
  config: BotVariantConfig
  name: string
  initialX: number
  initialZ: number
  buildingWidth: number
  buildingDepth: number
  onBotClick?: (session: CrewSession) => void
}

function OutdoorBot({ session, config, name, initialX, initialZ, buildingWidth, buildingDepth, onBotClick }: OutdoorBotProps) {
  const groupRef = useRef<THREE.Group>(null)
  const walkPhaseRef = useRef(0)
  const { focusBot } = useWorldFocus()

  const stateRef = useRef<WanderState>({
    currentX: initialX,
    currentZ: initialZ,
    targetX: initialX,
    targetZ: initialZ,
    waitTimer: Math.random() * 3, // stagger initial wait
    rotY: Math.random() * Math.PI * 2,
  })

  // Stable ref for animation (SleepingZs reads animRef.current.showZzz)
  const animRef = useRef<AnimState>({
    phase: 'sleeping',
    targetX: null,
    targetZ: null,
    walkSpeed: OUTDOOR_WALK_SPEED,
    freezeWhenArrived: false,
    arrived: false,
    bodyTilt: 0,
    headBob: false,
    opacity: 1,
    yOffset: 0,
    showZzz: true,
    sleepRotZ: 0,
    coffeeTimer: 0,
    resetWanderTarget: false,
    isActiveWalking: false,
    typingPause: false,
    typingPauseTimer: 0,
    nextTypingPauseTimer: 0,
  })

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    const state = stateRef.current
    const t = clock.getElapsedTime()

    const dx = state.targetX - state.currentX
    const dz = state.targetZ - state.currentZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < 0.5) {
      // Arrived at target — wait, then pick a new target
      state.waitTimer -= delta
      if (state.waitTimer <= 0) {
        const [nx, nz] = getRandomOutdoorPosition(buildingWidth, buildingDepth)
        // Bias toward staying somewhat close to current position
        state.targetX = state.currentX + (nx - state.currentX) * 0.4
        state.targetZ = state.currentZ + (nz - state.currentZ) * 0.4
        state.waitTimer = PAUSE_MIN_S + Math.random() * (PAUSE_MAX_S - PAUSE_MIN_S)
      }

      // Idle breathing
      walkPhaseRef.current *= 0.9
      if (Math.abs(walkPhaseRef.current) < 0.01) walkPhaseRef.current = 0
    } else {
      // Walk toward target
      const speed = OUTDOOR_WALK_SPEED
      const step = Math.min(speed * delta, dist)
      state.currentX += (dx / dist) * step
      state.currentZ += (dz / dist) * step

      // Smooth rotation
      const targetRotY = Math.atan2(dx, dz)
      let angleDiff = targetRotY - state.rotY
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
      state.rotY += angleDiff * 0.12

      // Walk animation phase
      walkPhaseRef.current += delta * 6
    }

    // Apply position
    groupRef.current.position.x = state.currentX
    groupRef.current.position.z = state.currentZ
    groupRef.current.position.y = 0.16 // ground level
    groupRef.current.rotation.y = state.rotY

    // Gentle breathing scale
    const breathe = 1 + Math.sin(t * 0.8) * 0.005
    groupRef.current.scale.setScalar(1.3) // same 30% increase as regular bots
    groupRef.current.scale.y = 1.3 * breathe
  })

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation()
        // Focus on the bot in a virtual "outdoor" room context
        focusBot(session.key, 'outdoor')
        if (onBotClick) onBotClick(session)
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <group position={[0, 0.33, 0]}>
        <BotStatusGlow status="sleeping" />
        <BotBody color={config.color} status="sleeping" walkPhaseRef={walkPhaseRef} />
        <BotFace status="sleeping" expression={config.expression} />
        <BotChestDisplay type={config.chestDisplay} color={config.color} />
        <BotAccessory type={config.accessory} color={config.color} />
        <SleepingZs animRef={animRef} />

        {/* Name tag */}
        <Html
          position={[0, -0.55, 0]}
          center
          distanceFactor={15}
          zIndexRange={[1, 5]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
        </Html>
      </group>
    </group>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export function WanderingBots3D({
  sleepingSessions,
  displayNames,
  buildingWidth,
  buildingDepth,
  onBotClick,
}: WanderingBots3DProps) {
  const lastRefreshRef = useRef(0)
  const selectedKeysRef = useRef<string[]>([])

  // Select a random subset of sleeping sessions
  const selectWanderers = useCallback(() => {
    if (sleepingSessions.length === 0) return []
    const count = Math.min(
      MIN_WANDERERS + Math.floor(Math.random() * (MAX_WANDERERS - MIN_WANDERERS + 1)),
      sleepingSessions.length,
    )
    // Shuffle and pick
    const shuffled = [...sleepingSessions].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map(s => s.key)
  }, [sleepingSessions])

  // Refresh selection periodically
  const wanderers = useMemo(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current > REFRESH_INTERVAL_MS || selectedKeysRef.current.length === 0) {
      selectedKeysRef.current = selectWanderers()
      lastRefreshRef.current = now
    }

    // Validate selected keys still exist in sleeping sessions
    const validKeys = new Set(sleepingSessions.map(s => s.key))
    const stillValid = selectedKeysRef.current.filter(k => validKeys.has(k))

    // If we lost too many, re-select
    if (stillValid.length < MIN_WANDERERS && sleepingSessions.length >= MIN_WANDERERS) {
      selectedKeysRef.current = selectWanderers()
      lastRefreshRef.current = now
      return selectedKeysRef.current
    }

    selectedKeysRef.current = stillValid
    return stillValid
  }, [sleepingSessions, selectWanderers])

  // Build bot data for selected wanderers
  const wanderingBots = useMemo(() => {
    return wanderers.map(key => {
      const session = sleepingSessions.find(s => s.key === key)
      if (!session) return null
      const config = getBotConfigFromSession(session.key, session.label)
      const name = getSessionDisplayName(session, displayNames.get(session.key))
      const [x, z] = getRandomOutdoorPosition(buildingWidth, buildingDepth)
      return { session, config, name, x, z }
    }).filter(Boolean) as { session: CrewSession; config: BotVariantConfig; name: string; x: number; z: number }[]
    // We intentionally use wanderers as the primary dep, not sleepingSessions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanderers])

  if (wanderingBots.length === 0) return null

  return (
    <group>
      {wanderingBots.map(bot => (
        <OutdoorBot
          key={bot.session.key}
          session={bot.session}
          config={bot.config}
          name={bot.name}
          initialX={bot.x}
          initialZ={bot.z}
          buildingWidth={buildingWidth}
          buildingDepth={buildingDepth}
          onBotClick={onBotClick}
        />
      ))}
    </group>
  )
}
