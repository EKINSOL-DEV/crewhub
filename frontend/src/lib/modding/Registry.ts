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
  private snapshot: RegistryEntry<T>[] = []
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

  /** List all entries. Returns a stable snapshot (changes only on mutation). */
  list(): RegistryEntry<T>[] {
    if (this.snapshotDirty) {
      this.snapshot = Array.from(this.entries.values())
      this.snapshotDirty = false
    }
    return this.snapshot
  }

  /** List entries filtered by source. */
  listBySource(source: 'builtin' | 'mod'): RegistryEntry<T>[] {
    return this.list().filter((e) => e.source === source)
  }

  /** Subscribe to changes. Returns an unsubscribe function.
   *  Compatible with React's useSyncExternalStore. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Get the current snapshot reference (for useSyncExternalStore getSnapshot). */
  getSnapshot = (): RegistryEntry<T>[] => {
    return this.list()
  }

  /** Number of registered entries. */
  get size(): number {
    return this.entries.size
  }

  private notify(): void {
    this.snapshotDirty = true
    for (const listener of this.listeners) {
      listener()
    }
  }
}
