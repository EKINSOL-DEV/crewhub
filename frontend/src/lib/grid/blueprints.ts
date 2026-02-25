// ─── Room Blueprints ────────────────────────────────────────────
// Room blueprints are now loaded from JSON data files and registered
// via blueprintRegistry (see blueprintLoader.ts).
//
// This module re-exports the public API for backward compatibility.
// getBlueprintForRoom() delegates to blueprintRegistry with fuzzy
// matching fallback for room names.

import type { RoomBlueprint } from './types'
import { blueprintRegistry } from '@/lib/modding/registries'

// Ensure built-in blueprints are registered (side-effect import)
import './blueprintLoader'

// ─── ROOM_BLUEPRINTS getter ─────────────────────────────────────
// Returns a live record built from the registry each time it's called.
// This replaces the old static `ROOM_BLUEPRINTS` constant that was
// computed once at module load and never updated.

export function getRoomBlueprintsRecord(): Record<string, RoomBlueprint> {
  const record: Record<string, RoomBlueprint> = {}
  for (const entry of blueprintRegistry.list()) {
    record[entry.id] = entry.data
  }
  return record
}

/**
 * @deprecated Use `getRoomBlueprintsRecord()` or `blueprintRegistry` directly.
 * This is a compatibility shim — it returns a snapshot that is NOT live.
 */
export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = getRoomBlueprintsRecord()

// ─── Fuzzy name → blueprint ID mapping ──────────────────────────
// Ordered by specificity: longer/more-specific keywords first to
// prevent partial matches (e.g. "devops" matching "dev" before "ops").

const NAME_MATCHERS: Array<{ test: (name: string) => boolean; blueprintId: string }> = [
  { test: (n) => n.includes('headquarter'), blueprintId: 'headquarters' },
  { test: (n) => n.includes('devops'), blueprintId: 'ops-room' },
  { test: (n) => n.includes('automation') || n.includes('cron'), blueprintId: 'automation-room' },
  { test: (n) => n.includes('creative') || n.includes('design'), blueprintId: 'creative-room' },
  { test: (n) => n.includes('marketing'), blueprintId: 'marketing-room' },
  { test: (n) => n.includes('thinking') || n.includes('strategy'), blueprintId: 'thinking-room' },
  { test: (n) => n.includes('operation'), blueprintId: 'ops-room' },
  { test: (n) => n.includes('comms') || n.includes('comm'), blueprintId: 'comms-room' },
  { test: (n) => n.includes('dev'), blueprintId: 'dev-room' },
  { test: (n) => n.includes('ops'), blueprintId: 'ops-room' },
]

/**
 * Get blueprint for a room by name.
 *
 * Resolution order:
 * 1. Exact match in blueprintRegistry (room name as-is)
 * 2. Fuzzy name matching (keyword detection, ordered by specificity)
 * 3. Fallback to 'default' blueprint
 */
export function getBlueprintForRoom(roomName: string): RoomBlueprint {
  // 1. Try exact registry lookup (supports future blueprintId field on rooms)
  const exact = blueprintRegistry.get(roomName)
  if (exact) return exact

  // 2. Fuzzy matching by room name keywords
  const name = roomName.toLowerCase()
  for (const matcher of NAME_MATCHERS) {
    if (matcher.test(name)) {
      const bp = blueprintRegistry.get(matcher.blueprintId)
      if (bp) return bp
    }
  }

  // 3. Fallback to default
  const fallback = blueprintRegistry.get('default')
  if (fallback) return fallback

  // 4. Emergency fallback: generate a minimal default
  // This should never happen if blueprintLoader.ts is imported
  throw new Error(
    `[getBlueprintForRoom] No blueprint found for "${roomName}" and no default registered`
  )
}
