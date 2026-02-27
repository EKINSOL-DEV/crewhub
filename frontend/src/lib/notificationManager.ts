/**
 * NotificationManager — system notifications + tray badge for Tauri desktop.
 *
 * Responsibilities:
 * - Listen to SSE events for agent session updates (completions, new messages).
 * - When the app window is hidden (not focused), send a macOS system notification
 *   via @tauri-apps/plugin-notification.
 * - Increment the tray badge count via the Rust `update_tray_badge` command.
 * - Reset the badge count to 0 when the window regains focus.
 *
 * Only active in the Tauri desktop context (window.__TAURI__ or window.__TAURI_INTERNALS__ present).
 */

import { sseManager } from './sseManager'

// Lazy-import Tauri APIs only in Tauri context to avoid errors in browser.
// We use dynamic import so this module is safe to import everywhere.
type TauriNotifyFn = (options: { title: string; body?: string }) => void
type TauriInvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

let _notify: TauriNotifyFn | null = null
let _invoke: TauriInvokeFn | null = null

function isInTauri(): boolean {
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined
  )
}

async function getTauriApis(): Promise<boolean> {
  if (!isInTauri()) return false
  if (_notify && _invoke) return true

  try {
    const [notifModule, apiModule] = await Promise.all([
      import('@tauri-apps/plugin-notification'),
      import('@tauri-apps/api/core'),
    ])
    _notify = notifModule.sendNotification
    _invoke = apiModule.invoke
    return true
  } catch (err) {
    console.warn('[NotificationManager] Failed to load Tauri APIs:', err)
    return false
  }
}

// ── State ─────────────────────────────────────────────────────

/** Current badge count (unread notifications while window was hidden). */
let badgeCount = 0

/** Whether the window is currently visible/focused. */
let isWindowVisible = true

/**
 * Track session statuses we've already seen so we can detect transitions.
 * Keyed by session key.
 */
const seenSessions = new Map<string, { updatedAt: number; notified: boolean }>()

// ── Helpers ───────────────────────────────────────────────────

async function sendTrayBadge(count: number): Promise<void> {
  if (!_invoke) return
  try {
    await _invoke('update_tray_badge', { count })
  } catch (err) {
    console.warn('[NotificationManager] update_tray_badge failed:', err)
  }
}

function sendSystemNotification(title: string, body?: string): void {
  if (!_notify) return
  try {
    _notify({ title, body: body?.slice(0, 150) })
  } catch (err) {
    console.warn('[NotificationManager] sendNotification failed:', err)
  }
}

async function incrementBadge(): Promise<void> {
  badgeCount++
  await sendTrayBadge(badgeCount)
}

async function resetBadge(): Promise<void> {
  if (badgeCount === 0) return
  badgeCount = 0
  await sendTrayBadge(0)
}

// ── SSE Event Handlers ────────────────────────────────────────

/**
 * Handles `session-updated` SSE events.
 *
 * Fires a notification when a session's updatedAt timestamp changes,
 * indicating the agent produced output while the window was hidden.
 *
 * We use updatedAt as a proxy for "new activity" — it changes whenever
 * the backend writes new messages or the run state changes.
 */
function handleSessionUpdated(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data)
    const session = data.session ?? data
    const key: string = session.key || session.sessionId
    if (!key) return

    const updatedAt: number = session.updatedAt ?? 0
    const prev = seenSessions.get(key)

    // Update our tracking map
    seenSessions.set(key, { updatedAt, notified: prev?.notified ?? false })

    // Only notify if:
    // 1. We've seen this session before (so we know it's a NEW update, not initial load)
    // 2. The updatedAt has increased (new activity)
    // 3. The window is currently hidden
    if (!prev) return // First time seeing this session — just track it
    if (updatedAt <= prev.updatedAt) return // No new activity
    if (isWindowVisible) {
      // Window visible — just update tracking, no notification needed
      seenSessions.set(key, { updatedAt, notified: false })
      return
    }

    // Window is hidden + new activity detected → notify
    const agentName: string = session.displayName || session.label || session.key || 'Agent'
    const lastMessage: string = extractLastMessage(session)
    const title = `${agentName} is klaar`

    sendSystemNotification(title, lastMessage)
    incrementBadge()

    // Mark as notified so we don't double-fire
    seenSessions.set(key, { updatedAt, notified: true })
  } catch (err) {
    console.warn('[NotificationManager] handleSessionUpdated error:', err)
  }
}

/**
 * Handles `session-created` events — track new sessions immediately.
 */
function handleSessionCreated(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data)
    const session = data.session ?? data
    const key: string = session.key || session.sessionId
    if (!key) return

    const updatedAt: number = session.updatedAt ?? 0
    seenSessions.set(key, { updatedAt, notified: false })
  } catch {
    // ignore
  }
}

/**
 * Handles `session-removed` events — clean up tracking state.
 */
function handleSessionRemoved(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data)
    const key: string = data.key || data.sessionId || data.session?.key
    if (key) seenSessions.delete(key)
  } catch {
    // ignore
  }
}

/**
 * Extract text from a message content value (string or block array).
 */
function extractTextFromContent(content: unknown): string | null {
  if (typeof content === 'string') return content.slice(0, 100)
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (typeof block === 'object' && block !== null && 'text' in block) {
      const text = (block as { text: string }).text
      if (text) return text.slice(0, 100)
    }
  }
  return null
}

/**
 * Extract a readable summary from a session's recent messages.
 * Returns first 100 chars of the last assistant message, or a default.
 */
function extractLastMessage(session: {
  messages?: Array<{ role: string; content: unknown }>
}): string {
  if (!session.messages?.length) return 'Taak afgerond'

  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i]
    if (msg.role !== 'assistant') continue
    const text = extractTextFromContent(msg.content)
    if (text) return text
  }

  return 'Taak afgerond'
}

// ── Visibility handling ───────────────────────────────────────

function handleVisibilityChange(): void {
  const wasHidden = !isWindowVisible
  isWindowVisible = document.visibilityState === 'visible'

  if (wasHidden && isWindowVisible) {
    // Window just became visible — reset badge
    resetBadge()
  }
}

function handleWindowFocus(): void {
  isWindowVisible = true
  resetBadge()
}

function handleWindowBlur(): void {
  isWindowVisible = false
}

// ── Public API ────────────────────────────────────────────────

let initialized = false
let unsubscribers: Array<() => void> = []

/**
 * Initialize the NotificationManager.
 *
 * Should be called once at app startup, inside a Tauri context check:
 * ```ts
 * if (window.__TAURI_INTERNALS__) {
 *   notificationManager.init()
 * }
 * ```
 */
export async function init(): Promise<void> {
  if (initialized) return
  if (!isInTauri()) {
    console.log('[NotificationManager] Not in Tauri context — skipping init')
    return
  }

  const ready = await getTauriApis()
  if (!ready) return

  initialized = true
  isWindowVisible = document.visibilityState === 'visible'

  // Subscribe to SSE events
  unsubscribers = [
    sseManager.subscribe('session-created', handleSessionCreated),
    sseManager.subscribe('session-updated', handleSessionUpdated),
    sseManager.subscribe('session-removed', handleSessionRemoved),
  ]

  // Window visibility/focus tracking
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('blur', handleWindowBlur)

  console.log('[NotificationManager] Initialized ✓')
}

/**
 * Tear down the NotificationManager (unsubscribe all listeners).
 * Useful for testing or hot-reload scenarios.
 */
export function destroy(): void {
  if (!initialized) return

  for (const unsub of unsubscribers) unsub()
  unsubscribers = []

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('blur', handleWindowBlur)

  initialized = false
  badgeCount = 0
  seenSessions.clear()

  console.log('[NotificationManager] Destroyed')
}

export const notificationManager = { init, destroy }
