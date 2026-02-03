import { useEffect, useMemo, useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type BotAnimState =
  | 'working'
  | 'walking-to-desk'
  | 'idle-wandering'
  | 'getting-coffee'
  | 'sleeping'
  | 'offline'

export interface BotAnimationResult {
  animState: BotAnimState
  /** Target position in *room-local* coordinates (room centered at 0,0,0). */
  targetPosition: [number, number, number] | null
  /** Forward lean when working (radians). */
  bodyTilt: number
  /** 0 = no bob, 0.02 = gentle bob. */
  headBobAmount: number
  /** 1.0 normal, 0.4 offline */
  opacity: number
  showZzz: boolean
  /** Lower when sleeping. */
  yOffset: number
}

// ───────────────────────────────────────────────────────────────
// Room interaction points
// ───────────────────────────────────────────────────────────────

function getRoomType(roomName: string): string {
  const name = roomName.toLowerCase()
  if (name.includes('headquarter')) return 'headquarters'
  if (name.includes('dev')) return 'dev'
  if (name.includes('creative') || name.includes('design')) return 'creative'
  if (name.includes('marketing')) return 'marketing'
  if (name.includes('thinking') || name.includes('strategy')) return 'thinking'
  if (name.includes('automation') || name.includes('cron')) return 'automation'
  if (name.includes('comms') || name.includes('comm')) return 'comms'
  if (name.includes('ops') || name.includes('operation')) return 'ops'
  return 'default'
}

/**
 * Approximate positions of furniture per room type.
 * Returns *room-local* coordinates (room centered at [0,0,0]).
 */
export function getRoomInteractionPoints(roomName: string, roomSize: number) {
  const half = roomSize / 2 - 0.3
  const defaults = {
    deskPosition: [half * 0.5, 0, -half * 0.3] as [number, number, number],
    coffeePosition: [-half * 0.7, 0, half * 0.6] as [number, number, number],
    sleepCorner: [-half * 0.8, 0, -half * 0.8] as [number, number, number],
  }

  const t = getRoomType(roomName)
  switch (t) {
    case 'headquarters':
      return {
        ...defaults,
        // Coffee machine + water cooler exist here
        coffeePosition: [half * 0.65, 0, -half * 0.65],
        deskPosition: [-half * 0.55, 0, half * 0.55],
        sleepCorner: [half * 0.75, 0, half * 0.75],
      }
    case 'dev':
      return {
        ...defaults,
        deskPosition: [-half * 0.55, 0, half * 0.55],
        coffeePosition: null as any, // no coffee prop in this room
        sleepCorner: [half * 0.75, 0, -half * 0.75],
      }
    case 'creative':
      return {
        ...defaults,
        deskPosition: [half * 0.55, 0, half * 0.55],
        coffeePosition: null as any,
        sleepCorner: [-half * 0.75, 0, -half * 0.75],
      }
    case 'marketing':
      return {
        ...defaults,
        deskPosition: [-half * 0.55, 0, half * 0.55],
        coffeePosition: null as any,
        sleepCorner: [half * 0.75, 0, -half * 0.75],
      }
    case 'thinking':
      return {
        ...defaults,
        deskPosition: [0, 0, 0],
        coffeePosition: null as any,
        sleepCorner: [-half * 0.75, 0, -half * 0.75],
      }
    case 'automation':
      return {
        ...defaults,
        deskPosition: [-half * 0.55, 0, -half * 0.55],
        coffeePosition: null as any,
        sleepCorner: [half * 0.75, 0, half * 0.75],
      }
    case 'comms':
      return {
        ...defaults,
        deskPosition: [half * 0.55, 0, -half * 0.55],
        coffeePosition: null as any,
        sleepCorner: [-half * 0.75, 0, half * 0.75],
      }
    case 'ops':
      return {
        ...defaults,
        deskPosition: [0, 0, 0],
        coffeePosition: null as any,
        sleepCorner: [-half * 0.75, 0, half * 0.75],
      }
    default:
      return defaults
  }
}

// ───────────────────────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────────────────────

export function useBotAnimation(
  status: 'active' | 'idle' | 'sleeping' | 'offline',
  roomName: string,
  roomSize: number,
): BotAnimationResult {
  // stable per-bot decision/jitter
  const idleMode = useRef<'coffee' | 'wander'>(Math.random() < 0.5 ? 'coffee' : 'wander')
  const jitter = useRef({
    x: (Math.random() - 0.5) * 0.8,
    z: (Math.random() - 0.5) * 0.8,
  })

  const points = useMemo(() => getRoomInteractionPoints(roomName, roomSize), [roomName, roomSize])

  const [animState, setAnimState] = useState<BotAnimState>(() => {
    if (status === 'offline') return 'offline'
    if (status === 'sleeping') return 'sleeping'
    if (status === 'active') return 'walking-to-desk'
    return idleMode.current === 'coffee' ? 'getting-coffee' : 'idle-wandering'
  })

  const coffeeTimer = useRef(0)

  useEffect(() => {
    if (status === 'offline') {
      setAnimState('offline')
      return
    }
    if (status === 'sleeping') {
      setAnimState('sleeping')
      return
    }
    if (status === 'active') {
      setAnimState('walking-to-desk')
      return
    }

    // idle
    if (idleMode.current === 'coffee' && points.coffeePosition) {
      setAnimState('getting-coffee')
      coffeeTimer.current = 5
    } else {
      setAnimState('idle-wandering')
    }
  }, [status, points.coffeePosition])

  // after coffee wait → wander
  useFrame((_, delta) => {
    if (animState !== 'getting-coffee') return
    // We don't know arrival here; Bot3D will stop at target and keep idle.
    // Run a simple countdown once coffee state is entered.
    if (coffeeTimer.current > 0) {
      coffeeTimer.current -= delta
      if (coffeeTimer.current <= 0) {
        setAnimState('idle-wandering')
      }
    }
  })

  // derive output
  const { x, z } = jitter.current

  let targetPosition: [number, number, number] | null = null
  let bodyTilt = 0
  let headBobAmount = 0
  let opacity = 1
  let showZzz = false
  let yOffset = 0

  if (animState === 'offline') {
    opacity = 0.4
    targetPosition = null
  }

  if (status === 'active') {
    if (animState === 'walking-to-desk' || animState === 'working') {
      targetPosition = [points.deskPosition[0] + x, 0, points.deskPosition[2] + z]
    }
    if (animState === 'working') {
      bodyTilt = 0.1
      headBobAmount = 0.02
    }
  }

  if (status === 'idle') {
    if (animState === 'getting-coffee' && points.coffeePosition) {
      targetPosition = [points.coffeePosition[0] + x * 0.5, 0, points.coffeePosition[2] + z * 0.5]
    } else {
      targetPosition = null
    }
  }

  if (status === 'sleeping') {
    // walk to corner; once arrived Bot3D will freeze, but we still show Zs.
    targetPosition = [points.sleepCorner[0] + x * 0.3, 0, points.sleepCorner[2] + z * 0.3]
    yOffset = -0.05
    showZzz = true
    bodyTilt = -0.05
  }

  return {
    animState,
    targetPosition,
    bodyTilt,
    headBobAmount,
    opacity,
    showZzz,
    yOffset,
  }
}

// ───────────────────────────────────────────────────────────────
// ZzzParticles
// ───────────────────────────────────────────────────────────────

export function ZzzParticles() {
  const zRefs = useRef<THREE.Group[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    zRefs.current.forEach((ref, i) => {
      if (!ref) return
      const phase = (t * 0.6 + i * 1.2) % 3
      ref.position.y = 0.75 + phase * 0.25
      ref.position.x = Math.sin(t + i) * 0.12
      const opacity = phase < 2.5 ? 0.85 : Math.max(0, 0.85 - (phase - 2.5) * 1.7)
      ref.scale.setScalar(0.55 + phase * 0.12)
      ref.traverse((child) => {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as any
        if (mat && typeof mat.opacity === 'number') {
          mat.transparent = true
          mat.opacity = opacity
        }
      })
    })
  })

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => { if (el) zRefs.current[i] = el }}>
          <Text
            fontSize={0.1}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={0.85}
          >
            Z
          </Text>
        </group>
      ))}
    </group>
  )
}
