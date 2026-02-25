/**
 * Centralized session configuration — all hardcoded thresholds and timing values.
 *
 * Uses localStorage for persistent overrides and a simple event system
 * so React components re-render when config changes.
 */

// ─── Default Values ─────────────────────────────────────────────

export const SESSION_CONFIG_DEFAULTS = {
  // ── Status Thresholds ──
  // Time since last update to determine session status
  statusActiveThresholdMs: 300_000, // 5min — active → idle
  statusSleepingThresholdMs: 1_800_000, // 30min — idle → sleeping

  // 3D bot status uses finer-grained thresholds
  botIdleThresholdMs: 120_000, // 2min — active/idle boundary
  botSleepingThresholdMs: 1_800_000, // 30min — sleeping → offline

  // ── Activity Detection ──
  tokenChangeThresholdMs: 30_000, // 30s — token change = actively running
  updatedAtActiveMs: 30_000, // 30s — updatedAt within this = active

  // ── Parking ──
  parkingIdleThresholdS: 120, // 2min — idle seconds before parking
  parkingExpiryMs: 1_800_000, // 30min — hide parked sessions after this
  parkingMaxVisible: 15, // max sessions in main view before overflow to parking

  // ── Bot Movement (3D) ──
  botWalkSpeedActive: 1.2, // walk speed when heading to desk
  botWalkSpeedCoffee: 0.6, // walk speed going for coffee
  botWalkSpeedIdle: 0.3, // wander speed when idle
  botWalkSpeedSleepWalk: 0.4, // walk speed heading to sleep corner

  // ── Wander Behavior (3D) ──
  wanderMinWaitS: 4, // min seconds between wander moves
  wanderMaxWaitS: 8, // max seconds between wander moves
  wanderMinSteps: 3, // min cells per random walk
  wanderMaxSteps: 8, // max cells per random walk

  // ── Coffee Break (3D) ──
  coffeeMinTimeS: 5, // min seconds at coffee machine
  coffeeMaxTimeS: 10, // max seconds at coffee machine

  // ── Polling Intervals ──
  logViewerPollMs: 3_000, // log viewer refresh interval
  cronViewPollMs: 30_000, // cron view refresh interval

  // ── Playground 2D ──
  targetUpdateActiveMs: 2_000, // movement target update for active sessions
  targetUpdateIdleMs: 4_000, // movement target update for idle sessions

  // ── 3D Layout ──
  maxVisibleBotsPerRoom: 8, // limit rendered bots per room; overflow as "+N more"

  // ── Table/List Status Thresholds ──
  tableActiveThresholdMs: 30_000, // 30s — active status in table view
  tableIdleThresholdMs: 300_000, // 5min — idle status in table view
} as const

export type SessionConfigKey = keyof typeof SESSION_CONFIG_DEFAULTS
export type SessionConfig = { [K in SessionConfigKey]: number }

// ─── Storage Key ────────────────────────────────────────────────

const STORAGE_KEY = 'crewhub-session-config'

// ─── Event System ───────────────────────────────────────────────

type ConfigListener = () => void
const listeners = new Set<ConfigListener>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

export function subscribeConfig(listener: ConfigListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ─── Config State ───────────────────────────────────────────────

let overrides: Partial<SessionConfig> = {}

function loadOverrides(): Partial<SessionConfig> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Partial<SessionConfig>
  } catch {
    // Silently ignore parse errors
  }
  return {}
}

function saveOverrides(data: Partial<SessionConfig>) {
  try {
    if (Object.keys(data).length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch {
    // Silently ignore storage errors
  }
}

// Initialize on module load
overrides = loadOverrides()

// Cached snapshot for useSyncExternalStore (must return same reference if unchanged)
let cachedSnapshot: SessionConfig = { ...SESSION_CONFIG_DEFAULTS, ...overrides } as SessionConfig

function rebuildSnapshot() {
  cachedSnapshot = { ...SESSION_CONFIG_DEFAULTS, ...overrides } as SessionConfig
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Merged config: defaults + localStorage overrides.
 * Returns a cached object — same reference until config changes.
 * Safe for useSyncExternalStore.
 */
export function getSessionConfig(): SessionConfig {
  return cachedSnapshot
}

/** Convenience: the current config snapshot (re-exported for direct imports) */
export const SESSION_CONFIG: SessionConfig = new Proxy({} as SessionConfig, {
  get(_target, prop: string) {
    const cfg = getSessionConfig()
    return cfg[prop as SessionConfigKey]
  },
})

/** Update a single config value. Persists to localStorage and notifies listeners. */
export function updateConfig<K extends SessionConfigKey>(key: K, value: number): void {
  if (value === SESSION_CONFIG_DEFAULTS[key]) {
    // Value matches default — remove override
    delete overrides[key]
  } else {
    overrides[key] = value
  }
  saveOverrides(overrides)
  rebuildSnapshot()
  notifyListeners()
}

/** Update multiple config values at once. */
export function updateConfigBatch(updates: Partial<SessionConfig>): void {
  for (const [key, value] of Object.entries(updates)) {
    const k = key as SessionConfigKey
    if (value === SESSION_CONFIG_DEFAULTS[k]) {
      delete overrides[k]
    } else {
      overrides[k] = value
    }
  }
  saveOverrides(overrides)
  rebuildSnapshot()
  notifyListeners()
}

/** Reset all overrides to defaults. */
export function resetConfig(): void {
  overrides = {}
  saveOverrides(overrides)
  rebuildSnapshot()
  notifyListeners()
}

/** Check if a specific key has been overridden. */
export function isOverridden(key: SessionConfigKey): boolean {
  return key in overrides
}

/** Get the number of active overrides. */
export function getOverrideCount(): number {
  return Object.keys(overrides).length
}
