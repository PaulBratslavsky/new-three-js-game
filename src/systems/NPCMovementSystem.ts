import { World } from "../ecs/World";
import {
  NPC_DATA,
  PATH_FOLLOWER,
  POSITION,
  type NPCData,
  type PathFollower,
  type Position,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

const MAX_TARGET_ATTEMPTS = 20;

/**
 * Pick a random walkable cell within radius.
 * Returns cell coordinates (integers).
 */
function pickWalkableTargetCell(
  originX: number,
  originZ: number,
  radius: number
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const cellX = originCell.x + Math.floor(Math.cos(angle) * dist);
    const cellZ = originCell.z + Math.floor(Math.sin(angle) * dist);

    if (!pathfinder.isBlocked(cellX, cellZ)) {
      return { x: cellX, z: cellZ };
    }
  }
  return null;
}

/**
 * NPCMovementSystem - AI behavior for NPCs
 *
 * Picks random walkable targets within wander radius.
 * The actual pathfinding is handled by PathfindingSystem.
 */
export function createNPCMovementSystem(): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    const npcs = world.query(NPC_DATA, PATH_FOLLOWER, POSITION);

    for (const npcId of npcs) {
      const npc = world.getComponent<NPCData>(npcId, NPC_DATA);
      const pf = world.getComponent<PathFollower>(npcId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(npcId, POSITION);
      if (!npc || !pf || !pos) continue;

      // Store previous position
      npc.prevX = pos.x;
      npc.prevZ = pos.z;

      // Handle wait time
      if (npc.waitTime > 0) {
        npc.waitTime -= dt;
        continue;
      }

      // Check if NPC needs a new target
      const noPath = pf.pathIndex === -1 && pf.path.length === 0;
      const notRequesting = !pf.needsPath;
      const notWaiting = pf.pathRetryTime <= 0;

      if (noPath && notRequesting && notWaiting) {
        // Pick new random walkable target
        const targetCell = pickWalkableTargetCell(npc.originX, npc.originZ, npc.radius);

        if (targetCell) {
          const targetWorld = Pathfinder.cellToWorld(targetCell.x, targetCell.z);

          npc.targetX = targetWorld.x;
          npc.targetZ = targetWorld.z;

          pf.targetX = targetWorld.x;
          pf.targetZ = targetWorld.z;
          pf.needsPath = true;
        } else {
          // No walkable target, wait and try again
          npc.waitTime = 0.5;
        }
      }

      // Update facing based on movement
      if (pf.pathIndex >= 0 && pf.pathIndex < pf.path.length) {
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
