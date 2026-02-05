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

// ─── Backward-compatible ROOM_BLUEPRINTS record ─────────────────
// Consumers that access ROOM_BLUEPRINTS directly get a live view
// backed by the registry. This is a compatibility shim.

function buildBlueprintRecord(): Record<string, RoomBlueprint> {
  const record: Record<string, RoomBlueprint> = {}
  for (const entry of blueprintRegistry.list()) {
    record[entry.id] = entry.data
  }
  return record
}

export const ROOM_BLUEPRINTS: Record<string, RoomBlueprint> = buildBlueprintRecord()

// ─── Fuzzy name → blueprint ID mapping ──────────────────────────

const NAME_MATCHERS: Array<{ test: (name: string) => boolean; blueprintId: string }> = [
  { test: (n) => n.includes('headquarter'), blueprintId: 'headquarters' },
  { test: (n) => n.includes('dev'), blueprintId: 'dev-room' },
  { test: (n) => n.includes('creative') || n.includes('design'), blueprintId: 'creative-room' },
  { test: (n) => n.includes('marketing'), blueprintId: 'marketing-room' },
  { test: (n) => n.includes('thinking') || n.includes('strategy'), blueprintId: 'thinking-room' },
  { test: (n) => n.includes('automation') || n.includes('cron'), blueprintId: 'automation-room' },
  { test: (n) => n.includes('comms') || n.includes('comm'), blueprintId: 'comms-room' },
  { test: (n) => n.includes('ops') || n.includes('operation'), blueprintId: 'ops-room' },
]

/**
 * Get blueprint for a room by name.
 *
 * Resolution order:
 * 1. Exact match in blueprintRegistry (room name as-is)
 * 2. Fuzzy name matching (keyword detection)
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
  throw new Error(`[getBlueprintForRoom] No blueprint found for "${roomName}" and no default registered`)
}
