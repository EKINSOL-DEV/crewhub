// ─── Generic Registry<T> ────────────────────────────────────────
// A typed, observable registry for runtime-extensible content.
// Built-in content registers through the same API as mods.
// Compatible with React's useSyncExternalStore via subscribe().

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

  /** Register a new entry. Overwrites if id already exists. */
  register(id: string, data: T, source: 'builtin' | 'mod' = 'builtin', modId?: string): void {
    this.entries.set(id, { id, data, source, modId })
    this.notify()
  }

  /** Remove an entry by id. Returns true if it existed. */
  unregister(id: string): boolean {
    const existed = this.entries.delete(id)
    if (existed) this.notify()
    return existed
  }

  /** Remove all entries registered by a specific mod. Returns number of entries removed. */
  unregisterByModId(modId: string): number {
    let removed = 0
    for (const [id, entry] of this.entries) {
      if (entry.modId === modId) {
        this.entries.delete(id)
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
    this.notify()
  }

  /** Get entry data by id, or null if not found. */
  get(id: string): T | null {
    return this.entries.get(id)?.data ?? null
  }

  /** Get the full registry entry (with source metadata), or null. */
  getEntry(id: string): RegistryEntry<T> | null {
    return this.entries.get(id) ?? null
  }

  /** Check if an id is registered. */
  has(id: string): boolean {
    return this.entries.has(id)
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
