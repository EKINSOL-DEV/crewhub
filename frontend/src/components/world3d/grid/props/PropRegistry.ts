// ─── Prop Registry ──────────────────────────────────────────────
// Type definitions and public API for the prop registry.
// Delegates to the central Registry<PropEntry> instance.

import { propRegistry } from '@/lib/modding/registries'

// ─── Prop Component Interface ───────────────────────────────────

export type MountType = 'floor' | 'wall'

export interface PropProps {
  readonly position: [number, number, number]
  readonly rotation: number // degrees (0, 90, 180, 270)
  readonly cellSize: number
  readonly span?: { w: number; d: number }
}

export interface PropEntry {
  component: React.FC<PropProps>
  /** Mount type determines positioning behaviour:
   *  - 'floor': sits on the floor. yOffset is height of floor surface (typically 0.16).
   *  - 'wall': mounted on wall. yOffset is the wall-mount height (center of prop).
   *    Renderer handles wall-snapping and rotation for wall props.
   */
  mountType: MountType
  /** Y position offset from room base. Floor props: 0.16 (floor surface).
   *  Wall props: mount height (e.g., 1.2 for whiteboards, 2.2 for clocks). */
  yOffset: number
}

// ─── Public API (delegates to propRegistry) ─────────────────────

/**
 * Get the prop component for a given propId.
 * Returns null if not found (unknown props are silently skipped).
 */
export function getPropComponent(propId: string): React.FC<PropProps> | null {
  return propRegistry.get(propId)?.component ?? null
}

/**
 * Get the full prop entry (component + mount metadata) for a given propId.
 * Returns null if not found.
 */
export function getPropEntry(propId: string): PropEntry | null {
  return propRegistry.get(propId)
}

/**
 * Get the Y offset for a given propId.
 * Floor props default to 0.16 (floor surface); wall props default to 1.2.
 */
export function getPropYOffset(propId: string): number {
  const entry = propRegistry.get(propId)
  if (!entry) return 0.16 // default: floor surface
  return entry.yOffset
}

/**
 * Get the mount type for a given propId.
 * Returns 'floor' as default for unknown props.
 */
export function getPropMountType(propId: string): MountType {
  return propRegistry.get(propId)?.mountType ?? 'floor'
}

/**
 * Get all registered prop IDs.
 * Useful for editor prop palettes and debugging.
 */
export function getAllPropIds(): string[] {
  return propRegistry.list().map((e) => e.id)
}
