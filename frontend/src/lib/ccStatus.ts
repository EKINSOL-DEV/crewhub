/**
 * Claude Code session status constants — single source of truth.
 * Import these instead of duplicating status arrays across files.
 */

/** Statuses indicating the CC session is actively working */
export const CC_ACTIVE_STATUSES = ['responding', 'tool_use', 'waiting_permission'] as const

/** Statuses indicating the CC session is idle but alive */
export const CC_IDLE_STATUSES = ['waiting_input'] as const

/** Check whether a CC session status counts as "actively working" */
export function isCCActive(status: string | undefined): boolean {
  return CC_ACTIVE_STATUSES.includes(status as (typeof CC_ACTIVE_STATUSES)[number])
}

/**
 * All CC statuses that should be considered displayable (non-terminal).
 * Used by session filtering to keep CC sessions visible.
 */
export const DISPLAYABLE_CC_STATUSES = new Set<string>([
  ...CC_ACTIVE_STATUSES,
  ...CC_IDLE_STATUSES,
])
