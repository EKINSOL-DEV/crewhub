// ─── Registry Instances ─────────────────────────────────────────
// Singleton registries for all moddable content types.
// Built-in content is registered at startup via initBuiltins().
// Future mods register through the same API.

import { Registry } from './Registry'
import type { PropEntry } from '@/components/world3d/grid/PropRegistry'

// Phase 1: PropRegistry migration
export const propRegistry = new Registry<PropEntry>()

// Phase 1 (future): Other registries — instantiated now, populated later
// export const blueprintRegistry = new Registry<BlueprintRegistryEntry>()
// export const environmentRegistry = new Registry<EnvironmentRegistryEntry>()
// export const botVariantRegistry = new Registry<BotVariantConfig>()
