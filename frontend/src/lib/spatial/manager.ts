// ─── Spatial Manager ────────────────────────────────────────────
// Orchestrates vision, proximity, and navigation for a room.
// One SpatialManager per room — created when a room is focused,
// destroyed when focus moves elsewhere.
//
// This is the "glue" that ties the three subsystems together
// and provides a simple API for Bot3D and other components.

import { VisionSystem, type VisionConfig, type VisionResult } from './vision'
import { ProximityGrid } from './proximity'
import {
  SpatialNavigator,
  type NavigationPath,
  type NavigationConfig,
  gridToZone,
  type ZoneName,
} from './navigation'
import type { RoomBlueprint } from '@/lib/grid/types'

export interface BotSpatialInfo {
  /** Bot session key */
  sessionKey: string
  /** Current grid position */
  gridX: number
  gridZ: number
  /** Current zone */
  zone: ZoneName
  /** Facing angle in radians */
  facingAngle: number
  /** Currently visible props */
  visibleProps: string[]
  /** Nearby bots (within 5 cells) */
  nearbyBots: { sessionKey: string; distance: number }[]
  /** Active navigation path */
  activePath: NavigationPath | null
}

export interface SpatialState {
  /** Room this manager handles */
  roomId: string
  /** Room name */
  roomName: string
  /** All bot spatial info */
  bots: Map<string, BotSpatialInfo>
  /** Room layout summary (for context envelope) */
  layoutSummary: string
  /** Prop layout */
  propLayout: ReturnType<SpatialNavigator['getPropLayout']>
}

/**
 * Orchestrates spatial awareness for a single room.
 *
 * Usage:
 *   const manager = new SpatialManager(roomId, roomName, blueprint)
 *
 *   // Register bots
 *   manager.addBot('session-key', 5, 10, 0)
 *
 *   // Update positions (call from useFrame)
 *   manager.updateBotPosition('session-key', 6, 10, 0.5)
 *
 *   // Query
 *   const info = manager.getBotInfo('session-key')
 *   const canSee = manager.canBotSee('session-key', 'session-key-2')
 *   const path = manager.navigateTo('session-key', 'coffee-machine')
 */
export class SpatialManager {
  private readonly vision: VisionSystem
  private readonly proximity: ProximityGrid
  private readonly navigator: SpatialNavigator
  private readonly bots: Map<string, BotSpatialInfo> = new Map()
  private readonly blueprint: RoomBlueprint

  readonly roomId: string
  readonly roomName: string

  constructor(
    roomId: string,
    roomName: string,
    blueprint: RoomBlueprint,
    visionConfig?: Partial<VisionConfig>,
    navConfig?: Partial<NavigationConfig>
  ) {
    this.roomId = roomId
    this.roomName = roomName
    this.blueprint = blueprint

    this.vision = new VisionSystem(blueprint.cells, visionConfig)
    this.proximity = new ProximityGrid(
      blueprint.gridWidth,
      blueprint.gridDepth,
      4 // 4×4 cell hash buckets
    )
    this.navigator = new SpatialNavigator(blueprint.cells, navConfig)

    // Populate proximity grid with props from blueprint
    this.populatePropsFromBlueprint()
  }

  // ─── Bot Management ─────────────────────────────────────────

  /** Register a bot in this room */
  addBot(sessionKey: string, gridX: number, gridZ: number, facingAngle: number = 0): void {
    this.proximity.insert({
      id: sessionKey,
      x: gridX,
      z: gridZ,
      type: 'bot',
    })

    this.bots.set(sessionKey, {
      sessionKey,
      gridX,
      gridZ,
      zone: gridToZone(gridX, gridZ, this.blueprint.gridWidth, this.blueprint.gridDepth),
      facingAngle,
      visibleProps: [],
      nearbyBots: [],
      activePath: null,
    })
  }

  /** Remove a bot from this room */
  removeBot(sessionKey: string): void {
    this.proximity.remove(sessionKey)
    this.bots.delete(sessionKey)
  }

  /** Update a bot's position and facing (call frequently, e.g., from useFrame) */
  updateBotPosition(sessionKey: string, gridX: number, gridZ: number, facingAngle: number): void {
    const info = this.bots.get(sessionKey)
    if (!info) return

    info.gridX = gridX
    info.gridZ = gridZ
    info.facingAngle = facingAngle
    info.zone = gridToZone(gridX, gridZ, this.blueprint.gridWidth, this.blueprint.gridDepth)

    this.proximity.update(sessionKey, gridX, gridZ)
  }

  /**
   * Refresh spatial awareness for a bot.
   * Call periodically (e.g., every 500ms) rather than every frame.
   * Updates visible props and nearby bots.
   */
  refreshBotAwareness(sessionKey: string): BotSpatialInfo | null {
    const info = this.bots.get(sessionKey)
    if (!info) return null

    // Update visible props
    const visibleProps = this.vision.getVisibleProps(
      { x: info.gridX, z: info.gridZ },
      info.facingAngle
    )
    info.visibleProps = visibleProps.map((p) => p.propId)

    // Update nearby bots
    const nearbyEntities = this.proximity.queryRadius({
      x: info.gridX,
      z: info.gridZ,
      radius: 5,
      type: 'bot',
      excludeId: sessionKey,
    })
    info.nearbyBots = nearbyEntities.map((e) => ({
      sessionKey: e.id,
      distance: e.distance,
    }))

    return info
  }

  // ─── Vision Queries ─────────────────────────────────────────

  /** Can bot A see bot B? */
  canBotSee(observerKey: string, targetKey: string): VisionResult | null {
    const observer = this.bots.get(observerKey)
    const target = this.bots.get(targetKey)
    if (!observer || !target) return null

    return this.vision.canSee(
      { x: observer.gridX, z: observer.gridZ },
      { x: target.gridX, z: target.gridZ },
      observer.facingAngle
    )
  }

  /** What can this bot see? */
  getVisibleCells(sessionKey: string): { x: number; z: number }[] {
    const info = this.bots.get(sessionKey)
    if (!info) return []

    return this.vision.getVisibleCells({ x: info.gridX, z: info.gridZ }, info.facingAngle)
  }

  // ─── Navigation ─────────────────────────────────────────────

  /** Navigate a bot to a prop */
  navigateTo(sessionKey: string, target: string, speed?: number): NavigationPath | null {
    const info = this.bots.get(sessionKey)
    if (!info) return null

    const path = this.navigator.navigateToProp({ x: info.gridX, z: info.gridZ }, target, speed)

    if (path) info.activePath = path
    return path
  }

  /** Navigate a bot to a zone */
  navigateToZone(sessionKey: string, zone: ZoneName, speed?: number): NavigationPath | null {
    const info = this.bots.get(sessionKey)
    if (!info) return null

    const path = this.navigator.navigateToZone({ x: info.gridX, z: info.gridZ }, zone, speed)

    if (path) info.activePath = path
    return path
  }

  // ─── Room Layout ────────────────────────────────────────────

  /** Get room layout summary (token-efficient, for context envelope) */
  getLayoutSummary(): string {
    return this.navigator.getLayoutSummary(this.roomName)
  }

  /** Get detailed prop layout */
  getPropLayout() {
    return this.navigator.getPropLayout()
  }

  /** Get spatial info for a specific bot */
  getBotInfo(sessionKey: string): BotSpatialInfo | null {
    return this.bots.get(sessionKey) || null
  }

  /** Get all bot spatial info */
  getAllBotInfo(): BotSpatialInfo[] {
    return Array.from(this.bots.values())
  }

  /** Get full spatial state (for debugging) */
  getState(): SpatialState {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      bots: new Map(this.bots),
      layoutSummary: this.getLayoutSummary(),
      propLayout: this.getPropLayout(),
    }
  }

  // ─── Private ──────────────────────────────────────────────────

  private populatePropsFromBlueprint(): void {
    const cells = this.blueprint.cells
    for (let z = 0; z < cells.length; z++) {
      for (let x = 0; x < cells[z].length; x++) {
        const cell = cells[z][x]
        if (cell.propId && !cell.spanParent) {
          this.proximity.insert({
            id: `prop:${cell.propId}@${x},${z}`,
            x,
            z,
            type: 'prop',
            meta: { propId: cell.propId, interactionType: cell.interactionType },
          })
        }
        if (cell.type === 'door') {
          this.proximity.insert({
            id: `door@${x},${z}`,
            x,
            z,
            type: 'door',
          })
        }
      }
    }
  }
}
