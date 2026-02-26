// ─── Proximity Detection System ─────────────────────────────────
// Fast spatial hashing for detecting nearby entities.
//
// Approach: Spatial Hash Grid
// Why this over alternatives:
//
// | Algorithm      | Insert | Query     | Memory | Good for                    |
// |---------------|--------|-----------|--------|-----------------------------|
// | Brute force    | O(1)   | O(n²)    | O(n)   | <10 entities                |
// | Spatial hash   | O(1)   | O(k)     | O(n)   | Fixed-size cells, even dist |
// | Quadtree       | O(log) | O(log+k) | O(n)   | Variable-density regions    |
// | K-D tree       | O(log) | O(log+k) | O(n)   | Static point clouds         |
//
// CrewHub has 5-20 bots per room on a 20×20 grid = well-suited for
// spatial hashing with cellSize = 3-5 grid cells. Simple, O(1) insert,
// O(k) neighbor query where k is nearby entities.
//
// For comparison: Three.js has Octree (via drei) for 3D spatial indexing,
// but that's overkill for our 2D grid with few entities.

export interface ProximityEntity {
  /** Unique identifier */
  id: string
  /** Grid X position */
  x: number
  /** Grid Z position */
  z: number
  /** Entity type for filtering */
  type: 'bot' | 'prop' | 'door' | 'interaction'
  /** Optional metadata */
  meta?: Record<string, unknown>
}

export interface ProximityQuery {
  /** Center of search */
  x: number
  z: number
  /** Search radius in grid cells */
  radius: number
  /** Filter by entity type */
  type?: ProximityEntity['type']
  /** Exclude this entity ID */
  excludeId?: string
  /** Maximum results to return */
  limit?: number
}

interface QueryResult extends ProximityEntity {
  /** Distance from query center */
  distance: number
}

/**
 * Spatial hash grid for fast proximity detection.
 *
 * Usage:
 *   const grid = new ProximityGrid(20, 20, 4) // 20×20 room, 4-cell buckets
 *   grid.insert({ id: 'bot-1', x: 5, z: 5, type: 'bot' })
 *   grid.insert({ id: 'desk', x: 10, z: 3, type: 'prop' })
 *   const nearby = grid.queryRadius({ x: 5, z: 5, radius: 3 })
 */
export class ProximityGrid {
  private readonly cells: Map<string, ProximityEntity[]> = new Map()
  private readonly entities: Map<string, ProximityEntity> = new Map()
  private readonly cellSize: number
  private readonly gridWidth: number
  private readonly gridDepth: number

  /**
   * @param gridWidth - Grid width in cells
   * @param gridDepth - Grid depth in cells
   * @param cellSize - Hash cell size (default: 4 = each hash bucket covers 4×4 grid cells)
   */
  constructor(gridWidth: number, gridDepth: number, cellSize: number = 4) {
    this.gridWidth = gridWidth
    this.gridDepth = gridDepth
    this.cellSize = cellSize
  }

  /** Hash a grid position to a cell key */
  private hash(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    return `${cx},${cz}`
  }

  /** Insert an entity into the grid */
  insert(entity: ProximityEntity): void {
    // Remove old position if entity exists
    this.remove(entity.id)

    const key = this.hash(entity.x, entity.z)
    if (!this.cells.has(key)) {
      this.cells.set(key, [])
    }
    this.cells.get(key)!.push(entity)
    this.entities.set(entity.id, entity)
  }

  /** Remove an entity by ID */
  remove(id: string): boolean {
    const existing = this.entities.get(id)
    if (!existing) return false

    const key = this.hash(existing.x, existing.z)
    const bucket = this.cells.get(key)
    if (bucket) {
      const idx = bucket.findIndex((e) => e.id === id)
      if (idx >= 0) bucket.splice(idx, 1)
      if (bucket.length === 0) this.cells.delete(key)
    }
    this.entities.delete(id)
    return true
  }

  /** Update an entity's position */
  update(id: string, x: number, z: number): void {
    const existing = this.entities.get(id)
    if (!existing) return

    const oldKey = this.hash(existing.x, existing.z)
    const newKey = this.hash(x, z)

    existing.x = x
    existing.z = z

    // Only rehash if cell changed
    if (oldKey !== newKey) {
      const oldBucket = this.cells.get(oldKey)
      if (oldBucket) {
        const idx = oldBucket.findIndex((e) => e.id === id)
        if (idx >= 0) oldBucket.splice(idx, 1)
        if (oldBucket.length === 0) this.cells.delete(oldKey)
      }
      if (!this.cells.has(newKey)) {
        this.cells.set(newKey, [])
      }
      this.cells.get(newKey)!.push(existing)
    }
  }

  /**
   * Query entities within a radius of a point.
   * Returns results sorted by distance (closest first).
   */
  queryRadius(query: ProximityQuery): QueryResult[] {
    // NOSONAR
    // NOSONAR: complexity from legitimate spatial grid query with filtering; splitting would hurt readability
    const { x, z, radius, type, excludeId, limit } = query
    const results: QueryResult[] = []

    // Determine which hash cells to check
    const minCX = Math.floor((x - radius) / this.cellSize)
    const maxCX = Math.floor((x + radius) / this.cellSize)
    const minCZ = Math.floor((z - radius) / this.cellSize)
    const maxCZ = Math.floor((z + radius) / this.cellSize)

    const radiusSq = radius * radius

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = `${cx},${cz}`
        const bucket = this.cells.get(key)
        if (!bucket) continue

        for (const entity of bucket) {
          if (excludeId && entity.id === excludeId) continue
          if (type && entity.type !== type) continue

          const dx = entity.x - x
          const dz = entity.z - z
          const distSq = dx * dx + dz * dz

          if (distSq <= radiusSq) {
            results.push({
              ...entity,
              distance: Math.sqrt(distSq),
            })
          }
        }
      }
    }

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance)

    return limit ? results.slice(0, limit) : results
  }

  /**
   * Find the nearest entity matching criteria.
   * More efficient than queryRadius when you only need one result.
   */
  findNearest(
    x: number,
    z: number,
    type?: ProximityEntity['type'],
    excludeId?: string
  ): QueryResult | null {
    // Expand search radius until we find something
    for (
      let radius = this.cellSize;
      radius <= Math.max(this.gridWidth, this.gridDepth);
      radius += this.cellSize
    ) {
      const results = this.queryRadius({ x, z, radius, type, excludeId, limit: 1 })
      if (results.length > 0) return results[0]
    }
    return null
  }

  /** Get all entities (for debugging) */
  getAll(): ProximityEntity[] {
    return Array.from(this.entities.values())
  }

  /** Clear all entities */
  clear(): void {
    this.cells.clear()
    this.entities.clear()
  }

  /** Number of tracked entities */
  get size(): number {
    return this.entities.size
  }
}
