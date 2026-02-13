// ─── Spatial Awareness System — Public API ──────────────────────
// v0.15.0 Research Prototype
//
// Provides vision, proximity detection, and enhanced pathfinding
// for CrewHub bots in the 3D world.
//
// Modules:
//   - vision: Raycasting-based line-of-sight checks
//   - proximity: Spatial hashing for fast neighbor detection
//   - navigation: Enhanced pathfinding with waypoints and smoothing

export { VisionSystem, type VisionConfig, type VisionResult } from './vision'
export { ProximityGrid, type ProximityEntity, type ProximityQuery } from './proximity'
export {
  SpatialNavigator,
  type NavigationPath,
  type NavigationConfig,
  smoothPath,
  gridToZone,
  type ZoneName,
} from './navigation'
export { SpatialManager, type SpatialState, type BotSpatialInfo } from './manager'
