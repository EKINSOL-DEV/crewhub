// ─── Generic Registry<T> ────────────────────────────────────────
// A typed, observable registry for runtime-extensible content.
// Built-in content registers through the same API as mods.
// Compatible with React's useSyncExternalStore via subscribe().
//
// IDs use namespaced format: "namespace:id" (e.g. "builtin:desk-large",
// "mymod:custom-table"). Built-in IDs also get a shorthand alias
// (e.g. "desk-large" → "builtin:desk-large") for backward compatibility.

/** Builtin namespace prefix. All built-in content uses this. */
export const BUILTIN_NS = 'builtin'

/** Validate that an id is in namespace:id format. */
function isNamespacedId(id: string): boolean {
  const colonIdx = id.indexOf(':')
  return colonIdx > 0 && colonIdx < id.length - 1
}

/** Build a fully-qualified namespaced id. */
export function qualifyId(id: string, namespace: string = BUILTIN_NS): string {
  return isNamespacedId(id) ? id : `${namespace}:${id}`
}

export interface RegistryEntry<T> {
  id: string
  data: T
  source: 'builtin' | 'mod'
  modId?: string
}

export class Registry<T> {
  private entries = new Map<string, RegistryEntry<T>>()
  private listeners = new Set<() => void>()
  private snapshot: readonly RegistryEntry<T>[] = []
  private snapshotDirty = true
  /** Shorthand aliases (plain id → namespaced id) for builtin entries. */
  private aliases = new Map<string, string>()

  /**
   * Register a new entry. ID must be in namespace:id format.
   * Builtin entries also get a shorthand alias (e.g. "desk" → "builtin:desk").
   * Overwrites if id already exists.
   */
  register(id: string, data: T, source: 'builtin' | 'mod' = 'builtin', modId?: string): void {
    if (!isNamespacedId(id)) {
      console.warn(
        `[Registry] ID '${id}' is not namespaced (expected 'namespace:id'). Auto-qualifying as '${BUILTIN_NS}:${id}'.`
      )
      id = `${BUILTIN_NS}:${id}`
    }
    this.entries.set(id, { id, data, source, modId })
    // Register shorthand alias for builtin entries
    if (source === 'builtin') {
      const shortId = id.substring(id.indexOf(':') + 1)
      this.aliases.set(shortId, id)
    }
    this.notify()
  }

  /**
   * Register multiple entries at once. Fires only ONE notification at the end.
   * Much more efficient than calling register() in a loop.
   */
  registerBatch(
    entries: Array<{ id: string; data: T; source?: 'builtin' | 'mod'; modId?: string }>
  ): void {
    for (const entry of entries) {
      let id = entry.id
      const source = entry.source ?? 'builtin'
      if (!isNamespacedId(id)) {
        console.warn(
          `[Registry] ID '${id}' is not namespaced (expected 'namespace:id'). Auto-qualifying as '${BUILTIN_NS}:${id}'.`
        )
        id = `${BUILTIN_NS}:${id}`
      }
      this.entries.set(id, { id, data: entry.data, source, modId: entry.modId })
      if (source === 'builtin') {
        const shortId = id.substring(id.indexOf(':') + 1)
        this.aliases.set(shortId, id)
      }
    }
    if (entries.length > 0) {
      this.notify()
    }
  }

  /** Remove an entry by id. Returns true if it existed. */
  unregister(id: string): boolean {
    // Resolve alias
    const resolvedId = this.resolveId(id)
    const existed = this.entries.delete(resolvedId)
    if (existed) {
      // Clean up alias if it was a builtin
      const shortId = resolvedId.substring(resolvedId.indexOf(':') + 1)
      this.aliases.delete(shortId)
      this.notify()
    }
    return existed
  }

  /** Remove all entries registered by a specific mod. Returns number of entries removed. */
  unregisterByModId(modId: string): number {
    let removed = 0
    for (const [id, entry] of this.entries) {
      if (entry.modId === modId) {
        this.entries.delete(id)
        // Clean up alias
        const shortId = id.substring(id.indexOf(':') + 1)
        if (this.aliases.get(shortId) === id) {
          this.aliases.delete(shortId)
        }
        removed++
      }
    }
    if (removed > 0) this.notify()
    return removed
  }

  /** Remove all entries from the registry. */
  clear(): void {
    if (this.entries.size === 0) return
    this.entries.clear()
    this.aliases.clear()
    this.notify()
  }

  /**
   * Get entry data by id, or null if not found.
   * Accepts both namespaced ("builtin:desk") and shorthand ("desk") for builtins.
   */
  get(id: string): T | null {
    return this.entries.get(this.resolveId(id))?.data ?? null
  }

  /**
   * Get the full registry entry (with source metadata), or null.
   * Accepts both namespaced and shorthand ids.
   */
  getEntry(id: string): RegistryEntry<T> | null {
    return this.entries.get(this.resolveId(id)) ?? null
  }

  /**
   * Check if an id is registered.
   * Accepts both namespaced and shorthand ids.
   */
  has(id: string): boolean {
    return this.entries.has(this.resolveId(id))
  }

  /** List all entries. Returns a frozen snapshot (changes only on mutation). */
  list(): readonly RegistryEntry<T>[] {
    if (this.snapshotDirty) {
      this.snapshot = Object.freeze([...this.entries.values()]) as readonly RegistryEntry<T>[]
      this.snapshotDirty = false
    }
    return this.snapshot
  }

  /** List entries filtered by source. */
  listBySource(source: 'builtin' | 'mod'): readonly RegistryEntry<T>[] {
    return this.list().filter((e) => e.source === source)
  }

  /** Subscribe to changes. Returns an unsubscribe function.
   *  Compatible with React's useSyncExternalStore.
   *  Arrow field ensures stable identity (no .bind() needed). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Get the current snapshot reference (for useSyncExternalStore getSnapshot). */
  getSnapshot = (): readonly RegistryEntry<T>[] => {
    return this.list()
  }

  /** Number of registered entries. */
  get size(): number {
    return this.entries.size
  }

  /**
   * Resolve an id: if it's already namespaced, use as-is.
   * Otherwise check aliases (shorthand for builtins).
   * Falls back to the raw id if no alias found.
   */
  private resolveId(id: string): string {
    if (isNamespacedId(id)) return id
    return this.aliases.get(id) ?? id
  }

  private notify(): void {
    this.snapshotDirty = true
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('[Registry] Listener threw during notification:', err)
      }
    }
  }
}
