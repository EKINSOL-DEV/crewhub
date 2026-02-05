// ─── PropRegistry (backward compatibility shim) ─────────────────
// This file re-exports everything from the split props/ module.
// Existing imports from './PropRegistry' continue to work.

export type { MountType, PropProps, PropEntry } from './props/PropRegistry'
export {
  getPropComponent,
  getPropEntry,
  getPropYOffset,
  getPropMountType,
  getAllPropIds,
} from './props/PropRegistry'

// Ensure built-in props are registered (side-effect)
import './props/builtinProps'
