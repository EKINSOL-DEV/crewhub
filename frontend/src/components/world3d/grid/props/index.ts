// ─── Props Module ───────────────────────────────────────────────
// Re-exports for backward compatibility.
// All exports from the old PropRegistry.tsx are available here.

// Types and public API
export type { MountType, PropProps, PropEntry } from './PropRegistry'
export {
  getPropComponent,
  getPropEntry,
  getPropYOffset,
  getPropMountType,
  getAllPropIds,
} from './PropRegistry'

// Ensure built-in props are registered (side-effect import)
import './builtinProps'
