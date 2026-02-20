/**
 * Task Constants
 * Canonical definitions for task priority and status configurations.
 * Single source of truth — import from here instead of defining locally.
 */

import type { TaskPriority, TaskStatus } from '@/hooks/useTasks'

// ── Priority Configuration ────────────────────────────────────────

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; weight: number }> = {
  urgent: { label: 'URG', color: 'var(--zen-error)', weight: 0 },
  high:   { label: 'HI',  color: 'var(--zen-warning)', weight: 1 },
  medium: { label: 'MED', color: 'var(--zen-info)', weight: 2 },
  low:    { label: 'LO',  color: 'var(--zen-fg-muted)', weight: 3 },
}

// ── Status Configuration ─────────────────────────────────────────

export const STATUS_CONFIG: Record<TaskStatus, { icon: string; label: string; color: string }> = {
  todo:        { icon: '📋', label: 'To Do',       color: 'var(--zen-fg-muted)' },
  in_progress: { icon: '🔄', label: 'In Progress', color: 'var(--zen-info)' },
  review:      { icon: '👀', label: 'Review',      color: 'var(--zen-warning)' },
  done:        { icon: '✅', label: 'Done',         color: 'var(--zen-success)' },
  blocked:     { icon: '⚠️', label: 'Blocked',     color: 'var(--zen-error)' },
}
