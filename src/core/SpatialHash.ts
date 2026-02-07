/**
 * Spatial hash grid for efficient proximity queries.
 * Divides 2D space (XZ plane) into cells and allows O(1) lookup of nearby entities.
 */
export class SpatialHash<T> {
  private cellSize: number;
  private cells: Map<string, T[]>;

  constructor(cellSize: number = 2) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  /** Clear all entries */
  clear(): void {
    this.cells.clear();
  }

  /** Get cell key for a position */
  private getKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  /** Insert an item at a position */
  insert(x: number, z: number, item: T): void {
    const key = this.getKey(x, z);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  /** Query all items in the same cell and neighboring cells */
  queryNearby(x: number, z: number): T[] {
    const results: T[] = [];
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);

    // Check 3x3 grid of cells centered on position
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${cellX + dx},${cellZ + dz}`;
        const cell = this.cells.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }

    return results;
  }

  /** Query items within a specific radius (more precise but slightly slower) */
  queryRadius(x: number, z: number, radius: number): T[] {
    const results: T[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const key = `${cellX + dx},${cellZ + dz}`;
        const cell = this.cells.get(key);
        if (cell) {
          results.push(...cell);
        }
      }
    }

    return results;
  }

  /** Get stats for debugging */
  getStats(): { cellCount: number; totalItems: number; avgPerCell: number } {
    let totalItems = 0;
    for (const cell of this.cells.values()) {
      totalItems += cell.length;
    }
    const cellCount = this.cells.size;
    return {
      cellCount,
      totalItems,
      avgPerCell: cellCount > 0 ? totalItems / cellCount : 0,
    };
  }
}
