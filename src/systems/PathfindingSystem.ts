import { World } from "../ecs/World";
import {
  PATH_FOLLOWER,
  POSITION,
  MOVEMENT_STATE,
  type PathFollower,
  type Position,
  type MovementState,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

const PATH_RETRY_COOLDOWN = 0.5;

/**
 * PathfindingSystem - Grid-based pathfinding
 *
 * Works the same way as point-and-click movement:
 * 1. Entity has a target cell
 * 2. A* finds path from current cell to target cell
 * 3. Entity moves cell-to-cell along the path
 *
 * NPCs use AI to pick targets, players would use mouse clicks.
 */
export function createPathfindingSystem(): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    const followers = world.query(PATH_FOLLOWER, POSITION);

    for (const entityId of followers) {
      const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(entityId, POSITION);
      if (!pf || !pos) continue;

      // Store previous position for collision revert (if entity has MovementState)
      const movement = world.getComponent<MovementState>(entityId, MOVEMENT_STATE);
      if (movement) {
        movement.prevX = pos.x;
        movement.prevZ = pos.z;
      }

      // Get current cell
      const currentCell = Pathfinder.worldToCell(pos.x, pos.z);

      // Handle path retry cooldown
      if (pf.pathRetryTime > 0) {
        pf.pathRetryTime -= dt;
      }

      // Request new path if needed
      if (pf.needsPath && pf.pathRetryTime <= 0) {
        const targetCell = Pathfinder.worldToCell(pf.targetX, pf.targetZ);

        // Find path (returns cell coordinates)
        const path = pathfinder.findPath(
          currentCell.x, currentCell.z,
          targetCell.x, targetCell.z
        );

        if (path && path.length > 0) {
          pf.path = path;
          pf.pathIndex = 0;
          pf.needsPath = false;
        } else {
          // No path found - wait and retry
          pf.pathRetryTime = PATH_RETRY_COOLDOWN;
          pf.needsPath = false;
        }
      }

      // No path to follow
      if (pf.pathIndex < 0 || pf.pathIndex >= pf.path.length) {
        continue;
      }

      // Get target waypoint (cell coordinate)
      const targetCell = pf.path[pf.pathIndex];

      // Convert to world position (cell center)
      const targetWorld = Pathfinder.cellToWorld(targetCell.x, targetCell.z);

      // Move toward target
      const dx = targetWorld.x - pos.x;
      const dz = targetWorld.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.05) {
        // Arrived at waypoint - snap to cell center
        pos.x = targetWorld.x;
        pos.z = targetWorld.z;
        pf.pathIndex++;

        // Check if reached end of path
        if (pf.pathIndex >= pf.path.length) {
          pf.pathIndex = -1;
          pf.path = [];
        }
      } else {
        // Move toward target
        const moveAmount = pf.moveSpeed * dt;
        const ratio = Math.min(moveAmount / dist, 1);
        pos.x += dx * ratio;
        pos.z += dz * ratio;
      }

      // Update mesh position
      const mesh = world.getObject3D(entityId);
      if (mesh) {
        mesh.position.x = pos.x;
        mesh.position.z = pos.z;

        // Face movement direction
        if (dist > 0.01) {
          mesh.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
  };
}
