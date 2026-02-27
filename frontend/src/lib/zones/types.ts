// Zone data model — Phase 1 MVP

// NOTE: CrewHub environments are registered by string ids (e.g. "builtin:grass").
// For Multi-Zone MVP we keep this flexible.
/* Environment type is plain string ids (e.g. "builtin:grass") */
export type ZoneLayoutType = 'campus' | 'hub-spoke' | 'arena' | 'classroom'

/** Feature flags for zone capabilities (stubs ok for MVP) */
export interface ZoneFeatureFlags {
  hasTaskBoard?: boolean
  hasChat?: boolean
  hasStreaming?: boolean
  hasLeaderboard?: boolean
  hasCourses?: boolean
  hasAssetLibrary?: boolean
}

export interface Zone {
  /** Unique identifier, e.g. 'main-campus' */
  id: string
  /** Display name */
  name: string
  /** Emoji icon */
  icon: string
  /** Environment style */
  environment: string
  /** Primary accent colour */
  colorPrimary: string
  /** Layout strategy */
  layout: ZoneLayoutType
  /** Default camera/spawn position [x, y, z] */
  defaultSpawnPoint: [number, number, number]
  /** Whether this is the default zone on first visit */
  isDefault?: boolean
  /** Feature flags for this zone */
  features?: ZoneFeatureFlags
  /** Short description shown on landing */
  description?: string
}

/** Mutable per-user runtime state, persisted to localStorage */
export interface ZoneRuntimeState {
  version: number
  activeZoneId: string
  perZoneState: Record<string, PerZoneState>
}

export interface PerZoneState {
  lastPosition: [number, number, number] | null
  lastVisitTimestamp: number
}
