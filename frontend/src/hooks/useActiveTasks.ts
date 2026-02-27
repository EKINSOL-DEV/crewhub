import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CrewSession } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'
import { getSessionStatus } from '@/lib/minionUtils'

// ── Types ──────────────────────────────────────────────────────

export interface ActiveTask {
  id: string
  title: string
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  status: 'running' | 'done'
  /** Timestamp when status changed to 'done' (for fade-out timing) */
  doneAt: number | null
  /** Source of this task: 'session' (subagent) or 'task' (planner task) */
  source: 'session' | 'task'
}

interface UseActiveTasksOptions {
  /** Sessions to scan for active subagents */
  sessions: CrewSession[]
  /** Duration in ms before removing done tasks (default: 30000) */
  fadeOutDuration?: number
  /** Whether the hook is enabled */
  enabled?: boolean
}

// ── Constants ──────────────────────────────────────────────────

const DEFAULT_FADE_OUT_DURATION = 30000
/** How long since last update before considering a session "done" (60 seconds) */
const IDLE_THRESHOLD_MS = 60_000

// ── Hook ───────────────────────────────────────────────────────

export function useActiveTasks(options: UseActiveTasksOptions) {
  const { sessions, fadeOutDuration = DEFAULT_FADE_OUT_DURATION, enabled = true } = options

  const [tasks, setTasks] = useState<ActiveTask[]>([])
  const previousSessionKeysRef = useRef<Set<string>>(new Set())
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Main effect: Track sessions and detect completions ───────

  useEffect(() => {
    if (!enabled) {
      setTasks([])
      return
    }

    // Build a map for quick lookup of session by key
    const sessionMap = new Map<string, CrewSession>()
    for (const s of sessions) {
      if (isSubagentSession(s.key)) {
        sessionMap.set(s.key, s)
      }
    }

    const currentKeys = new Set(sessionMap.keys())
    const previousKeys = previousSessionKeysRef.current

    /**
     * Check if a session is still actively running.
     * A session is considered "done" when:
     * - Its key disappears from the sessions list, OR
     * - Its status becomes "sleeping" (parked after 30min inactivity), OR
     * - Its updatedAt is older than IDLE_THRESHOLD_MS (60s) — means it stopped working
     */
    const isSessionStillRunning = (sessionKey: string): boolean => {
      const session = sessionMap.get(sessionKey)
      if (!session) return false

      // Check 1: If sleeping, it's definitely done
      const status = getSessionStatus(session)
      if (status === 'sleeping') return false

      // Check 2: If updatedAt is stale (>60s ago), consider done
      // This catches subagents that finished but haven't been parked yet
      const now = Date.now()
      const lastUpdate = session.updatedAt
      if (now - lastUpdate > IDLE_THRESHOLD_MS) return false

      return true
    }

    setTasks((prevTasks) => {
      const newTasks: ActiveTask[] = []
      const seenIds = new Set<string>()

      reconcileExistingTasks(prevTasks, newTasks, seenIds, currentKeys, previousKeys, isSessionStillRunning)
      addNewSessionTasks(sessions, newTasks, seenIds, isSessionStillRunning)

      previousSessionKeysRef.current = currentKeys
      return newTasks
    })
  }, [sessions, enabled])

  // ── Cleanup timer: Remove done tasks after fadeOutDuration ───

  useEffect(() => {
    if (!enabled) return

    const scheduleCleanup = () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current)
      }

      cleanupTimerRef.current = setTimeout(() => {
        setTasks((prevTasks) =>
          prevTasks.filter(makeExpiredTaskFilter(Date.now(), fadeOutDuration))
        )
        scheduleCleanup() // Reschedule
      }, 1000) // Check every second
    }

    scheduleCleanup()

    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current)
      }
    }
  }, [enabled, fadeOutDuration])

  // ── SSE: Listen for session removal events ───────────────────

  useEffect(() => {
    if (!enabled) return

    const handleSessionRemoved = (event: MessageEvent) => {
      try {
        const { key } = JSON.parse(event.data)
        if (!isSubagentSession(key)) return

        setTasks((prevTasks) => prevTasks.map(markTaskDone(key)))
      } catch {
        // Ignore parse errors
      }
    }

    const unsub = sseManager.subscribe('session-removed', handleSessionRemoved)
    return () => unsub()
  }, [enabled])

  // ── Computed values ──────────────────────────────────────────

  const runningTasks = useMemo(() => tasks.filter((t) => t.status === 'running'), [tasks])

  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks])

  const getTaskOpacity = useCallback(
    (task: ActiveTask): number => {
      if (task.status !== 'done' || !task.doneAt) return 1
      const elapsed = Date.now() - task.doneAt
      const progress = Math.min(elapsed / fadeOutDuration, 1)
      return 1 - progress
    },
    [fadeOutDuration]
  )

  return {
    tasks,
    runningTasks,
    doneTasks,
    getTaskOpacity,
    fadeOutDuration,
  }
}

// ── Helper Functions ───────────────────────────────────────────

/**
 * Check if a session key represents a subagent/spawned session
 */
function reconcileExistingTasks(
  prevTasks: ActiveTask[],
  newTasks: ActiveTask[],
  seenIds: Set<string>,
  currentKeys: Set<string>,
  previousKeys: Set<string>,
  isSessionStillRunning: (key: string) => boolean
): void {
  for (const task of prevTasks) {
    if (task.source !== 'session' || !task.sessionKey) continue

    const key = task.sessionKey
    const stillActive = (currentKeys.has(key) && isSessionStillRunning(key)) || task.status === 'done'

    if (stillActive) {
      newTasks.push(task)
      seenIds.add(task.id)
    } else if (task.status === 'running' && (previousKeys.has(key) || currentKeys.has(key))) {
      newTasks.push({ ...task, status: 'done', doneAt: Date.now() })
      seenIds.add(task.id)
    }
  }
}

function addNewSessionTasks(
  sessions: CrewSession[],
  newTasks: ActiveTask[],
  seenIds: Set<string>,
  isSessionStillRunning: (key: string) => boolean
): void {
  for (const session of sessions) {
    if (!isSubagentSession(session.key)) continue
    const taskId = `session:${session.key}`
    if (seenIds.has(taskId)) continue
    if (!isSessionStillRunning(session.key)) continue

    newTasks.push({
      id: taskId,
      title: extractTaskTitle(session),
      sessionKey: session.key,
      agentName: extractAgentName(session.key),
      agentIcon: extractAgentIcon(session.key),
      status: 'running',
      doneAt: null,
      source: 'session',
    })
  }
}

function isSubagentSession(key: string): boolean {
  return key.includes(':subagent:') || key.includes(':spawn:')
}

/**
 * Returns a filter predicate for tasks that should be kept alive.
 * Extracted to module level to reduce setState callback nesting depth.
 */
function makeExpiredTaskFilter(now: number, fadeOutDuration: number) {
  return (task: ActiveTask): boolean =>
    task.status !== 'done' || !task.doneAt || now - task.doneAt < fadeOutDuration
}

/**
 * Marks a task as done when its session is removed.
 * Extracted to module level to reduce setState callback nesting depth.
 */
function markTaskDone(key: string) {
  return (task: ActiveTask): ActiveTask =>
    task.sessionKey === key && task.status === 'running'
      ? { ...task, status: 'done' as const, doneAt: Date.now() }
      : task
}

/**
 * Extract a readable task title from a session
 */
function extractTaskTitle(session: CrewSession): string {
  // Prefer label if it exists and is meaningful
  if (session.label) {
    // Clean up common patterns
    const cleanLabel = session.label
      .replaceAll(/parent=[^\s]+/g, '')
      .replaceAll(/model=[^\s]+/g, '')
      .replace(/^(subagent|spawn):?\s*/i, '')
      .trim()

    if (cleanLabel && cleanLabel.length > 0) {
      return cleanLabel
    }
  }

  // Fall back to extracting from session key
  const parts = session.key.split(':')
  // agent:name:subagent:task-id → task-id
  const lastPart = parts[parts.length - 1]
  if (lastPart && lastPart.length > 4) {
    return lastPart.replaceAll('-', ' ')
  }

  return 'Working...'
}

/**
 * Extract agent name from session key
 */
function extractAgentName(sessionKey: string): string {
  // agent:main:subagent:xxx → main
  // agent:dev:spawn:xxx → dev
  const parts = sessionKey.split(':')
  if (parts.length >= 2 && parts[0] === 'agent') {
    return parts[1]
  }
  return 'agent'
}

/**
 * Extract agent icon from session key
 */
function extractAgentIcon(sessionKey: string): string {
  const agentName = extractAgentName(sessionKey)
  // Common agent icons
  const iconMap: Record<string, string> = {
    main: '🤖',
    dev: '👨‍💻',
    assistant: '🧑‍💼',
    ops: '⚙️',
    data: '📊',
    test: '🧪',
  }
  return iconMap[agentName.toLowerCase()] || '🤖'
}
