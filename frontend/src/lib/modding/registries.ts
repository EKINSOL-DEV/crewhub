// ─── Registry Instances ─────────────────────────────────────────
// Singleton registries for all moddable content types.
// Built-in content is registered at startup via initBuiltins().
// Future mods register through the same API.

import type { ComponentType } from 'react'
import { Registry } from './Registry'
import type { PropEntry } from '@/components/world3d/grid/PropRegistry'

// ─── Prop Registry ──────────────────────────────────────────────

export const propRegistry = new Registry<PropEntry>()

// ─── Environment Registry ───────────────────────────────────────

/** Props that every environment component receives. */
export interface EnvironmentComponentProps {
  readonly buildingWidth: number
  readonly buildingDepth: number
}

/** Configuration for a registered environment. */
export interface EnvironmentConfig {
  /** Human-readable display name (e.g. "🌿 Classic Grass") */
  name: string
  /** Short description shown in the UI */
  description: string
  /** React component that renders the environment */
  component: ComponentType<EnvironmentComponentProps>
  /** Optional thumbnail URL for previews */
  thumbnail?: string
}

export const environmentRegistry = new Registry<EnvironmentConfig>()

// ─── Blueprint Registry ─────────────────────────────────────────

import type { RoomBlueprint } from '@/lib/grid/types'

export const blueprintRegistry = new Registry<RoomBlueprint>()

// Phase 1 (future): Other registries — instantiated now, populated later
// export const botVariantRegistry = new Registry<BotVariantConfig>()
