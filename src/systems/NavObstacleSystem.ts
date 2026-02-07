import { World } from "../ecs/World";
import {
  NAV_OBSTACLE,
  POSITION,
  type Position,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

/**
 * NavObstacleSystem - Syncs entities with NavObstacle component to the pathfinder.
 *
 * Any entity with Position + NavObstacle blocks the cell it occupies.
 */
export function createNavObstacleSystem(): (world: World, dt: number) => void {
  // Track which cells we've registered for each entity
  const registeredCells = new Map<number, string>(); // entityId -> "x,z"

  return (world: World, _dt: number) => {
    const obstacles = world.query(NAV_OBSTACLE, POSITION);
    const currentObstacles = new Set<number>();

    // Register new obstacles
    for (const entityId of obstacles) {
      currentObstacles.add(entityId);

      const pos = world.getComponent<Position>(entityId, POSITION);
      if (!pos) continue;

      // Convert world position to cell
      const cell = Pathfinder.worldToCell(pos.x, pos.z);
      const key = `${cell.x},${cell.z}`;

      // Already registered at this cell
      const existingKey = registeredCells.get(entityId);
      if (existingKey === key) continue;

      // If moved, unregister old cell
      if (existingKey) {
        const [oldX, oldZ] = existingKey.split(",").map(Number);
        pathfinder.setWalkable(oldX, oldZ);
      }

      // Register new cell
      pathfinder.setBlocked(cell.x, cell.z);
      registeredCells.set(entityId, key);
    }

    // Unregister removed obstacles
    for (const [entityId, key] of registeredCells) {
      if (!currentObstacles.has(entityId)) {
        const [x, z] = key.split(",").map(Number);
        pathfinder.setWalkable(x, z);
        registeredCells.delete(entityId);
      }
    }
  };
}
