/**
 * A* Pathfinding on a 2D grid.
 *
 * Grid system:
 * - Cells are identified by integer coordinates (x, z)
 * - Cell (5, 7) is the square area from (5, 7) to (6, 8)
 * - Blocks placed at (5, 7) occupy cell (5, 7)
 * - Works the same for player click-to-move or AI-controlled NPCs
 */

interface Node {
  x: number;
  z: number;
  g: number;  // Cost from start
  h: number;  // Heuristic to goal
  f: number;  // Total (g + h)
  parent: Node | null;
}

export interface PathPoint {
  x: number;
  z: number;
}

export class Pathfinder {
  private blocked: Set<string>;

  constructor() {
    this.blocked = new Set();
  }

  /** Convert world position to cell coordinate (round to nearest integer) */
  static worldToCell(worldX: number, worldZ: number): { x: number; z: number } {
    return { x: Math.round(worldX), z: Math.round(worldZ) };
  }

  /** Convert cell coordinate to world position (cell center = integer) */
  static cellToWorld(cellX: number, cellZ: number): { x: number; z: number } {
    return { x: cellX, z: cellZ };
  }

  /** Mark a cell as blocked */
  setBlocked(cellX: number, cellZ: number): void {
    const key = `${cellX},${cellZ}`;
    this.blocked.add(key);
  }

  /** Mark a cell as walkable */
  setWalkable(cellX: number, cellZ: number): void {
    const key = `${cellX},${cellZ}`;
    this.blocked.delete(key);
  }

  /** Check if a cell is blocked */
  isBlocked(cellX: number, cellZ: number): boolean {
    const key = `${cellX},${cellZ}`;
    return this.blocked.has(key);
  }

  /** Clear all blocked cells */
  clear(): void {
    this.blocked.clear();
  }

  /** Get blocked cell count for debugging */
  getBlockedCount(): number {
    return this.blocked.size;
  }

  /**
   * Find path from start cell to goal cell.
   * Returns array of cell coordinates, or null if no path.
   *
   * Usage (same for player click or NPC AI):
   *   const startCell = Pathfinder.worldToCell(entity.x, entity.z);
   *   const goalCell = Pathfinder.worldToCell(clickX, clickZ);
   *   const path = pathfinder.findPath(startCell.x, startCell.z, goalCell.x, goalCell.z);
   */
  findPath(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number,
    maxIterations: number = 1000
  ): PathPoint[] | null {
    // Ensure integer cell coordinates
    const sx = Math.floor(startX);
    const sz = Math.floor(startZ);
    const gx = Math.floor(goalX);
    const gz = Math.floor(goalZ);

    // Can't path to blocked cell - return null, let caller handle it
    if (this.isBlocked(gx, gz)) {
      return null;
    }

    // Can't path from blocked cell
    if (this.isBlocked(sx, sz)) {
      return null;
    }

    // Already at goal
    if (sx === gx && sz === gz) {
      return [{ x: gx, z: gz }];
    }

    const openSet: Node[] = [];
    const closedSet = new Set<string>();

    const startNode: Node = {
      x: sx,
      z: sz,
      g: 0,
      h: this.heuristic(sx, sz, gx, gz),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }
      const current = openSet[currentIndex];

      // Reached goal
      if (current.x === gx && current.z === gz) {
        return this.reconstructPath(current);
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.z}`);

      // Check 4 cardinal neighbors (no diagonals for simpler grid movement)
      const neighbors = [
        { x: current.x - 1, z: current.z },
        { x: current.x + 1, z: current.z },
        { x: current.x, z: current.z - 1 },
        { x: current.x, z: current.z + 1 },
      ];

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.z}`;

        // Skip if in closed set or blocked
        if (closedSet.has(key)) continue;
        if (this.isBlocked(neighbor.x, neighbor.z)) continue;

        const g = current.g + 1;
        const h = this.heuristic(neighbor.x, neighbor.z, gx, gz);
        const f = g + h;

        // Check if already in open set with better score
        const existingIndex = openSet.findIndex(n => n.x === neighbor.x && n.z === neighbor.z);
        if (existingIndex !== -1) {
          if (g < openSet[existingIndex].g) {
            openSet[existingIndex].g = g;
            openSet[existingIndex].f = f;
            openSet[existingIndex].parent = current;
          }
          continue;
        }

        // Add to open set
        openSet.push({
          x: neighbor.x,
          z: neighbor.z,
          g,
          h,
          f,
          parent: current,
        });
      }
    }

    // No path found
    return null;
  }

  /** Manhattan distance heuristic */
  private heuristic(x1: number, z1: number, x2: number, z2: number): number {
    return Math.abs(x2 - x1) + Math.abs(z2 - z1);
  }

  /** Reconstruct path from goal node */
  private reconstructPath(goalNode: Node): PathPoint[] {
    const path: PathPoint[] = [];
    let current: Node | null = goalNode;

    while (current !== null) {
      path.unshift({ x: current.x, z: current.z });
      current = current.parent;
    }

    return path;
  }
}

// Global pathfinder instance
export const pathfinder = new Pathfinder();
