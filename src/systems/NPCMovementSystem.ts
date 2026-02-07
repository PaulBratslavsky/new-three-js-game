import { World } from "../ecs/World";
import {
  NPC_DATA,
  PATH_FOLLOWER,
  POSITION,
  WANDER_BEHAVIOR,
  SEEK_BEHAVIOR,
  PLAYER_ENTITY,
  type NPCData,
  type PathFollower,
  type Position,
  type WanderBehavior,
  type SeekBehavior,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

const MAX_TARGET_ATTEMPTS = 20;

/**
 * Pick a random walkable cell within radius, avoiding player's cell.
 * Returns cell coordinates (integers).
 */
function pickWalkableTargetCell(
  originX: number,
  originZ: number,
  radius: number,
  avoidCell?: { x: number; z: number }
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const cellX = originCell.x + Math.floor(Math.cos(angle) * dist);
    const cellZ = originCell.z + Math.floor(Math.sin(angle) * dist);

    // Check if blocked by terrain
    if (pathfinder.isBlocked(cellX, cellZ)) continue;

    // Check if this is the cell to avoid (player position)
    if (avoidCell && cellX === avoidCell.x && cellZ === avoidCell.z) continue;

    return { x: cellX, z: cellZ };
  }
  return null;
}

/**
 * NPCMovementSystem - AI behavior for entities with WanderBehavior
 *
 * Only processes entities that HAVE WanderBehavior component.
 * This means players (who don't wander) won't be affected.
 * The actual pathfinding is handled by PathfindingSystem.
 */
export function createNPCMovementSystem(): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    // Get player cell to avoid
    const playerPos = world.getComponent<Position>(PLAYER_ENTITY, POSITION);
    const playerCell = playerPos
      ? Pathfinder.worldToCell(playerPos.x, playerPos.z)
      : undefined;

    // Query entities with wander behavior (not all entities with PathFollower)
    const wanderers = world.query(WANDER_BEHAVIOR, PATH_FOLLOWER, POSITION);

    for (const entityId of wanderers) {
      const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
      const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(entityId, POSITION);
      if (!wander || !pf || !pos) continue;

      // Skip wandering if entity is seeking or in seek-and-destroy mode
      const seek = world.getComponent<SeekBehavior>(entityId, SEEK_BEHAVIOR);
      if (seek && (seek.state === "seeking" || seek.state === "seek-and-destroy")) {
        continue; // SeekSystem handles movement
      }

      // Note: MovementState tracking is handled by PathfindingSystem

      // Handle wait time (wander-specific behavior)
      if (wander.waitTime > 0) {
        wander.waitTime -= dt;
        continue;
      }

      // Check if entity needs a new target
      const noPath = pf.pathIndex === -1 && pf.path.length === 0;
      const notRequesting = !pf.needsPath;
      const notWaiting = pf.pathRetryTime <= 0;

      if (noPath && notRequesting && notWaiting) {
        // Pick new random walkable target within wander radius (avoiding player)
        const targetCell = pickWalkableTargetCell(wander.originX, wander.originZ, wander.radius, playerCell);

        if (targetCell) {
          const targetWorld = Pathfinder.cellToWorld(targetCell.x, targetCell.z);

          pf.targetX = targetWorld.x;
          pf.targetZ = targetWorld.z;
          pf.needsPath = true;
        } else {
          // No walkable target, wait and try again
          wander.waitTime = 0.5;
        }
      }

      // Update facing based on movement (if entity has NPCData for visual)
      const npc = world.getComponent<NPCData>(entityId, NPC_DATA);
      if (npc && pf.pathIndex >= 0 && pf.pathIndex < pf.path.length) {
        const waypoint = pf.path[pf.pathIndex];
        const targetWorld = Pathfinder.cellToWorld(waypoint.x, waypoint.z);
        const dx = targetWorld.x - pos.x;
        const dz = targetWorld.z - pos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          npc.facingAngle = Math.atan2(dx, dz);
        }
      }
    }
  };
}
