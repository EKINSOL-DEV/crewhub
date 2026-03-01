/* eslint-disable sonarjs/cognitive-complexity */
/**
 * Bot3D movement helpers — extracted from Bot3D useFrame to reduce cognitive complexity.
 */
import * as THREE from 'three'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { meetingGatheringState, calculateMeetingPath } from '@/lib/meetingStore'
import { botPositionRegistry } from './botConstants'
import { worldToGrid } from '@/lib/grid'

// ─── Cardinal + diagonal directions for random walk ──
export const DIRECTIONS = [
  { x: 0, z: -1 }, // N
  { x: 1, z: -1 }, // NE
  { x: 1, z: 0 }, // E
  { x: 1, z: 1 }, // SE
  { x: 0, z: 1 }, // S
  { x: -1, z: 1 }, // SW
  { x: -1, z: 0 }, // W
  { x: -1, z: -1 }, // NW
]

/** Smoothly rotate a group toward a target angle with dead-zone snap */
export function smoothRotateY(group: THREE.Group, targetRotY: number, lerpFactor = 0.2): void {
  const currentRotY = group.rotation.y
  let angleDiff = targetRotY - currentRotY
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
  if (Math.abs(angleDiff) < 0.01) {
    group.rotation.y = targetRotY
  } else {
    group.rotation.y = currentRotY + angleDiff * lerpFactor
  }
}

/** Calculate bounce Y offset based on animation phase and movement state */
export function calculateBounceY(
  phase: string,
  isMoving: boolean,
  isActiveWalking: boolean,
  typingPause: boolean,
  t: number
): number {
  switch (phase) {
    case 'getting-coffee':
    case 'sleeping-walking':
      return isMoving ? Math.sin(t * 4) * 0.03 : 0
    case 'idle-wandering':
      if (isActiveWalking && !typingPause) {
        return isMoving ? Math.sin(t * 3.5) * 0.025 : 0
      }
      return isMoving ? Math.sin(t * 3) * 0.02 : 0
    default:
      return 0
  }
}

/** Apply opacity change to a group's mesh materials */
export function applyOpacity(
  group: THREE.Group,
  opacity: number,
  materialsClonable: { current: boolean }
): void {
  group.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    if (!materialsClonable.current) {
      if (Array.isArray(mesh.material)) {
        mesh.material = (mesh.material as THREE.Material[]).map((m) => m.clone())
      } else {
        mesh.material = (mesh.material as THREE.Material).clone()
      }
    }
    const mats = Array.isArray(mesh.material)
      ? (mesh.material as THREE.Material[])
      : [mesh.material as THREE.Material]
    for (const mat of mats) {
      if ('opacity' in mat) {
        mat.transparent = opacity < 1
        mat.opacity = opacity
      }
    }
  })
  materialsClonable.current = true
}

/** Update bot position in registry */
export function updatePositionRegistry(
  sessionKey: string | undefined,
  x: number,
  y: number,
  z: number
): void {
  if (sessionKey) {
    botPositionRegistry.set(sessionKey, { x, y, z })
  }
}

/** Compute bot-to-bot soft repulsion to prevent overlapping */
export function computeBotRepulsion(
  sessionKey: string | undefined,
  currentX: number,
  currentZ: number,
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  gridData: {
    blueprint: { cellSize: number; gridWidth: number; gridDepth: number }
    botWalkableMask: boolean[][]
  } | null,
  roomCenterX: number,
  roomCenterZ: number,
  delta: number
): { dx: number; dz: number } {
  if (!sessionKey) return { dx: 0, dz: 0 }

  const radius = SESSION_CONFIG.wanderRepulsionRadius
  const strength = SESSION_CONFIG.wanderRepulsionStrength
  let pushX = 0
  let pushZ = 0
  let count = 0

  for (const [key, pos] of botPositionRegistry) {
    if (key === sessionKey) continue
    if (count >= 8) break
    count++

    const dx = currentX - pos.x
    const dz = currentZ - pos.z
    const dist = Math.hypot(dx, dz)

    if (dist < radius && dist > 0.01) {
      const force = (1 - dist / radius) * strength * delta
      pushX += (dx / dist) * force
      pushZ += (dz / dist) * force
    }
  }

  // Only apply if resulting position is walkable
  if (Math.abs(pushX) > 0.001 || Math.abs(pushZ) > 0.001) {
    const newX = currentX + pushX
    const newZ = currentZ + pushZ
    if (isWalkableAt(newX, newZ, roomBounds, gridData, roomCenterX, roomCenterZ)) {
      return { dx: pushX, dz: pushZ }
    }
  }

  return { dx: 0, dz: 0 }
}

/** Handle meeting gathering waypoint movement. Returns true if meeting movement was applied. */
export function handleMeetingMovement( // NOSONAR: meeting waypoint movement with path computation
  group: THREE.Group,
  state: {
    currentX: number
    currentZ: number
    meetingPathComputed: boolean
    meetingWaypoints: { x: number; z: number }[]
    meetingWaypointIndex: number
  },
  sessionKey: string | undefined,
  delta: number,
  frameStartX: number,
  frameStartZ: number,
  wasMovingRef: { current: boolean },
  walkPhaseRef: { current: number }
): boolean {
  const meetingPos = sessionKey ? meetingGatheringState.positions.get(sessionKey) : null
  if (!meetingPos || !meetingGatheringState.active) {
    if (!meetingGatheringState.active && state.meetingPathComputed) {
      state.meetingPathComputed = false
      state.meetingWaypoints = []
      state.meetingWaypointIndex = 0
    }
    return false
  }

  // Compute waypoints once when meeting gathering starts
  if (!state.meetingPathComputed) {
    const botRoomId = sessionKey ? meetingGatheringState.agentRooms.get(sessionKey) : undefined
    state.meetingWaypoints = calculateMeetingPath(
      state.currentX,
      state.currentZ,
      meetingPos.x,
      meetingPos.z,
      botRoomId,
      meetingGatheringState
    )
    state.meetingWaypointIndex = 0
    state.meetingPathComputed = true
  }

  const waypoints = state.meetingWaypoints
  const wpIdx = state.meetingWaypointIndex
  const isLastWaypoint = wpIdx >= waypoints.length - 1
  const currentTarget =
    wpIdx < waypoints.length ? waypoints[wpIdx] : { x: meetingPos.x, z: meetingPos.z }

  const dx = currentTarget.x - state.currentX
  const dz = currentTarget.z - state.currentZ
  const dist = Math.hypot(dx, dz)
  const arrivalThreshold = isLastWaypoint ? 0.3 : 0.5

  if (dist > arrivalThreshold) {
    const gatherSpeed = 1.8
    const step = Math.min(gatherSpeed * delta, dist)
    state.currentX += (dx / dist) * step
    state.currentZ += (dz / dist) * step
    smoothRotateY(group, Math.atan2(dx, dz), 0.2)
  } else if (isLastWaypoint) {
    group.rotation.y = meetingPos.angle
    state.currentX = meetingPos.x
    state.currentZ = meetingPos.z
  } else {
    state.meetingWaypointIndex++
  }

  group.position.x = state.currentX
  group.position.z = state.currentZ
  updatePositionRegistry(sessionKey, state.currentX, group.position.y, state.currentZ)

  // Walk animation
  const frameDx = state.currentX - frameStartX
  const frameDz = state.currentZ - frameStartZ
  const isMoving = Math.hypot(frameDx, frameDz) > 0.001
  wasMovingRef.current = isMoving
  if (isMoving) walkPhaseRef.current += delta * 8
  else {
    walkPhaseRef.current *= 0.85
    if (Math.abs(walkPhaseRef.current) < 0.01) walkPhaseRef.current = 0
  }

  return true
}

/** Check if a world position is walkable on a grid */
export function isWalkableAt(
  wx: number,
  wz: number,
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  gridData: {
    blueprint: { cellSize: number; gridWidth: number; gridDepth: number }
    botWalkableMask: boolean[][]
  } | null,
  roomCenterX: number,
  roomCenterZ: number
): boolean {
  if (!gridData) return true
  if (
    wx < roomBounds.minX ||
    wx > roomBounds.maxX ||
    wz < roomBounds.minZ ||
    wz > roomBounds.maxZ
  ) {
    return false
  }
  const { cellSize, gridWidth, gridDepth } = gridData.blueprint
  const g = worldToGrid(wx - roomCenterX, wz - roomCenterZ, cellSize, gridWidth, gridDepth)
  return !!gridData.botWalkableMask[g.z]?.[g.x]
}

/** Pick a walkable direction biased toward open space and room center */
export function pickWalkableDir(
  currentX: number,
  currentZ: number,
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  gridData: {
    blueprint: { cellSize: number; gridWidth: number; gridDepth: number }
    botWalkableMask: boolean[][]
  } | null,
  roomCenterX: number,
  roomCenterZ: number
): { x: number; z: number } | null {
  const cellSize = gridData ? gridData.blueprint.cellSize : 1
  const lookahead = SESSION_CONFIG.wanderLookahead
  const centerGravity = SESSION_CONFIG.wanderCenterGravity

  const scored: { dir: { x: number; z: number }; score: number }[] = []

  for (const d of DIRECTIONS) {
    // First cell must be walkable
    if (
      !isWalkableAt(
        currentX + d.x * cellSize,
        currentZ + d.z * cellSize,
        roomBounds,
        gridData,
        roomCenterX,
        roomCenterZ
      )
    )
      continue

    // Count consecutive walkable cells ahead
    let openCells = 1
    for (let i = 2; i <= lookahead; i++) {
      if (
        isWalkableAt(
          currentX + d.x * cellSize * i,
          currentZ + d.z * cellSize * i,
          roomBounds,
          gridData,
          roomCenterX,
          roomCenterZ
        )
      ) {
        openCells++
      } else {
        break
      }
    }

    // Linear openness score — enough to avoid furniture without herding all bots together
    let score = 1 + openCells

    // Center-gravity bias: gentle pull toward room center, only significant at edges
    const toCenterX = roomCenterX - currentX
    const toCenterZ = roomCenterZ - currentZ
    const distFromCenter = Math.hypot(toCenterX, toCenterZ)
    const halfRoomSize =
      Math.max(roomBounds.maxX - roomBounds.minX, roomBounds.maxZ - roomBounds.minZ) / 2
    if (distFromCenter > 0.1 && halfRoomSize > 0) {
      const normX = toCenterX / distFromCenter
      const normZ = toCenterZ / distFromCenter
      const dirMag = Math.hypot(d.x, d.z)
      const dot = (d.x / dirMag) * normX + (d.z / dirMag) * normZ
      const distanceFactor = Math.min(1, distFromCenter / halfRoomSize)
      score += Math.max(0, dot) * distanceFactor * centerGravity
    }

    // Large noise keeps movement non-deterministic — bots in the same spot diverge
    score += Math.random() * 3

    scored.push({ dir: d, score })
  }

  if (scored.length === 0) return null

  // Weighted random selection
  const totalWeight = scored.reduce((sum, s) => sum + s.score, 0)
  let r = Math.random() * totalWeight
  for (const s of scored) {
    r -= s.score
    if (r <= 0) return s.dir
  }

  return scored[scored.length - 1].dir
}

/** Handle no-grid circular wandering (parking bots). Returns true if handled. */
export function handleNoGridWander( // NOSONAR: circular wandering with wait/move state machine
  group: THREE.Group,
  state: {
    currentX: number
    currentZ: number
    targetX: number
    targetZ: number
    waitTimer: number
  },
  anim: {
    arrived: boolean
    freezeWhenArrived: boolean
    typingPause: boolean
  },
  hasAnimTarget: boolean,
  walkableCenter: { x: number; z: number; radius: number } | null,
  roomCenterX: number,
  roomCenterZ: number,
  speed: number,
  delta: number,
  sessionKey: string | undefined
): boolean {
  const dx = state.targetX - state.currentX
  const dz = state.targetZ - state.currentZ
  const dist = Math.hypot(dx, dz)

  if (dist < 0.4) {
    if (hasAnimTarget && !anim.arrived) {
      anim.arrived = true
      if (anim.freezeWhenArrived) {
        group.position.x = state.currentX
        group.position.z = state.currentZ
        updatePositionRegistry(sessionKey, state.currentX, group.position.y, state.currentZ)
        return true
      }
    }
    state.waitTimer -= delta
    if (state.waitTimer <= 0 && !hasAnimTarget) {
      if (walkableCenter) {
        const angle = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * walkableCenter.radius
        state.targetX = walkableCenter.x + Math.cos(angle) * r
        state.targetZ = walkableCenter.z + Math.sin(angle) * r
      } else {
        state.targetX = roomCenterX + (Math.random() - 0.5) * 2
        state.targetZ = roomCenterZ + (Math.random() - 0.5) * 2
      }
      state.waitTimer =
        SESSION_CONFIG.wanderMinWaitS +
        Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS)
    }
  } else {
    if (!anim.typingPause) {
      const easedSpeed = speed * Math.min(1, dist / 0.5)
      const step = Math.min(easedSpeed * delta, dist)
      state.currentX += (dx / dist) * step
      state.currentZ += (dz / dist) * step
    }
    smoothRotateY(group, Math.atan2(dx, dz), 0.2)
  }
  return false
}

export interface AnimWalkOptions {
  roomCenterX: number
  roomCenterZ: number
  speed: number
  delta: number
  sessionKey: string | undefined
}

/** Handle walking toward animation target (coffee/sleep) with grid-snapped pathfinding */
export function handleAnimTargetWalk(
  group: THREE.Group,
  state: {
    currentX: number
    currentZ: number
    targetX: number
    targetZ: number
  },
  anim: {
    arrived: boolean
    freezeWhenArrived: boolean
  },
  gridData: {
    blueprint: { cellSize: number; gridWidth: number; gridDepth: number }
    botWalkableMask: boolean[][]
  },
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  opts: AnimWalkOptions
): void {
  const dx = state.targetX - state.currentX
  const dz = state.targetZ - state.currentZ
  const dist = Math.hypot(dx, dz)

  if (dist < 0.4) {
    anim.arrived = true
    if (anim.freezeWhenArrived) {
      group.position.x = state.currentX
      group.position.z = state.currentZ
      updatePositionRegistry(opts.sessionKey, state.currentX, group.position.y, state.currentZ)
    }
    return
  }

  if (dist < 0.8) {
    // Close to target — direct linear movement
    const easedSpeed = opts.speed * Math.min(1, dist / 0.5)
    const step = Math.min(easedSpeed * opts.delta, dist)
    state.currentX += (dx / dist) * step
    state.currentZ += (dz / dist) * step
  } else {
    // Far from target — grid-snapped direction picking
    const cellSize = gridData.blueprint.cellSize
    const ndx = dx / dist
    const ndz = dz / dist

    let bestDir: { x: number; z: number } | null = null
    let bestScore = -Infinity
    for (const d of DIRECTIONS) {
      const nextX = state.currentX + d.x * cellSize
      const nextZ = state.currentZ + d.z * cellSize
      if (!isWalkableAt(nextX, nextZ, roomBounds, gridData, opts.roomCenterX, opts.roomCenterZ))
        continue
      const score = d.x * ndx + d.z * ndz
      if (score > bestScore) {
        bestScore = score
        bestDir = d
      }
    }

    if (bestDir) {
      const easedSpeed = opts.speed * Math.min(1, dist / 0.5)
      const step = Math.min(easedSpeed * opts.delta, dist)
      const dirMag = Math.hypot(bestDir.x, bestDir.z)
      state.currentX += (bestDir.x / dirMag) * step
      state.currentZ += (bestDir.z / dirMag) * step
    }
  }

  smoothRotateY(group, Math.atan2(dx, dz), 0.18)
}

export interface GridWalkOptions {
  roomCenterX: number
  roomCenterZ: number
  speed: number
  delta: number
}

/** Handle random grid walk with obstacle avoidance */
export function handleRandomGridWalk(
  group: THREE.Group,
  state: {
    currentX: number
    currentZ: number
    dirX: number
    dirZ: number
    stepsRemaining: number
    waitTimer: number
    cellProgress: number
    cellStartX: number
    cellStartZ: number
  },
  gridData: {
    blueprint: { cellSize: number; gridWidth: number; gridDepth: number }
    botWalkableMask: boolean[][]
  },
  roomBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  opts: GridWalkOptions
): void {
  const cellSize = gridData.blueprint.cellSize

  if (state.waitTimer > 0) {
    state.waitTimer -= opts.delta
    if (state.stepsRemaining > 0) {
      smoothRotateY(group, Math.atan2(state.dirX, state.dirZ), 0.15)
    }
    return
  }

  if (state.stepsRemaining <= 0) {
    const dir = pickWalkableDir(
      state.currentX,
      state.currentZ,
      roomBounds,
      gridData,
      opts.roomCenterX,
      opts.roomCenterZ
    )
    if (dir) {
      state.dirX = dir.x
      state.dirZ = dir.z
      state.stepsRemaining =
        SESSION_CONFIG.wanderMinSteps +
        Math.floor(
          Math.random() * (SESSION_CONFIG.wanderMaxSteps - SESSION_CONFIG.wanderMinSteps + 1)
        )
      state.cellProgress = 0
      state.cellStartX = state.currentX
      state.cellStartZ = state.currentZ
    } else {
      state.waitTimer = 1
    }
    return
  }

  // Walking phase — move forward one cell at a time
  const nextWorldX = state.currentX + state.dirX * cellSize
  const nextWorldZ = state.currentZ + state.dirZ * cellSize

  if (
    !isWalkableAt(nextWorldX, nextWorldZ, roomBounds, gridData, opts.roomCenterX, opts.roomCenterZ)
  ) {
    const dir = pickWalkableDir(
      state.currentX,
      state.currentZ,
      roomBounds,
      gridData,
      opts.roomCenterX,
      opts.roomCenterZ
    )
    if (dir) {
      state.dirX = dir.x
      state.dirZ = dir.z
      state.stepsRemaining =
        Math.max(2, SESSION_CONFIG.wanderMinSteps - 1) +
        Math.floor(Math.random() * (SESSION_CONFIG.wanderMaxSteps - SESSION_CONFIG.wanderMinSteps))
      state.cellProgress = 0
      state.cellStartX = state.currentX
      state.cellStartZ = state.currentZ
    } else {
      state.stepsRemaining = 0
      state.waitTimer = 1
    }
    return
  }

  // Move toward next cell.
  // Derive position from cellProgress (single source of truth) to avoid
  // floating-point accumulation errors causing a visible snap at cell completion.
  const easedSpeed = opts.speed * 1.2
  state.cellProgress += (easedSpeed * opts.delta) / cellSize
  if (state.cellProgress >= 1) {
    state.currentX = state.cellStartX + state.dirX * cellSize
    state.currentZ = state.cellStartZ + state.dirZ * cellSize
    state.stepsRemaining--
    state.cellProgress = 0
    state.cellStartX = state.currentX
    state.cellStartZ = state.currentZ
    if (state.stepsRemaining <= 0) {
      state.waitTimer =
        SESSION_CONFIG.wanderMinWaitS +
        Math.random() * (SESSION_CONFIG.wanderMaxWaitS - SESSION_CONFIG.wanderMinWaitS)
    }
  } else {
    // Interpolate directly from cellStart using progress — no += accumulation
    state.currentX = state.cellStartX + state.dirX * cellSize * state.cellProgress
    state.currentZ = state.cellStartZ + state.dirZ * cellSize * state.cellProgress
  }

  smoothRotateY(group, Math.atan2(state.dirX, state.dirZ), 0.15)
}

/** Handle waypoint path-following movement. Returns true if following a path. */
export function handlePathFollowing(
  group: THREE.Group,
  state: {
    currentX: number
    currentZ: number
    isFollowingPath: boolean
    pathWaypoints: { x: number; z: number }[]
    pathWaypointIndex: number
  },
  speed: number,
  delta: number
): boolean {
  if (!state.isFollowingPath || state.pathWaypoints.length === 0) return false

  const wp = state.pathWaypoints[state.pathWaypointIndex]
  if (!wp) {
    state.isFollowingPath = false
    state.pathWaypoints = []
    state.pathWaypointIndex = 0
    return false
  }

  const dx = wp.x - state.currentX
  const dz = wp.z - state.currentZ
  const dist = Math.hypot(dx, dz)

  if (dist < 0.3) {
    // Arrived at waypoint — advance to next
    state.pathWaypointIndex++
    if (state.pathWaypointIndex >= state.pathWaypoints.length) {
      state.isFollowingPath = false
      state.pathWaypoints = []
      state.pathWaypointIndex = 0
      return false
    }
    return true
  }

  // Move toward waypoint
  const pathSpeed = speed * 1.3
  const step = Math.min(pathSpeed * delta, dist)
  state.currentX += (dx / dist) * step
  state.currentZ += (dz / dist) * step
  smoothRotateY(group, Math.atan2(dx, dz), 0.18)

  return true
}
