import { World } from "../ecs/World";
import {
  COLLISION_STATE,
  POSITION,
  MOVEMENT_STATE,
  WANDER_BEHAVIOR,
  PATH_FOLLOWER,
  SEEK_BEHAVIOR,
  type CollisionState,
  type Position,
  type MovementState,
  type WanderBehavior,
  type PathFollower,
  type SeekBehavior,
} from "../ecs/components";

/**
 * CollisionResponseSystem - Handles collision responses for any entity with MovementState.
 *
 * Works for:
 * - NPCs (with WanderBehavior) - reverts position, picks new target
 * - Players (without WanderBehavior) - just reverts position
 * - Any moving entity - uses MovementState for position revert
 */
export function createCollisionResponseSystem(): (world: World, dt: number) => void {
  return (world: World, _dt: number) => {
    // Query entities that can be pushed back (have MovementState)
    const movers = world.query(MOVEMENT_STATE, POSITION, COLLISION_STATE);

    for (const entityId of movers) {
      const state = world.getComponent<CollisionState>(entityId, COLLISION_STATE);
      if (!state?.isColliding) continue;

      const movement = world.getComponent<MovementState>(entityId, MOVEMENT_STATE);
      const pos = world.getComponent<Position>(entityId, POSITION);
      if (!movement || !pos) continue;

      // Check what we're colliding with
      const blockContact = state.contacts.find(c => c.layer === "block");
      const playerContact = state.contacts.find(c => c.layer === "player");
      const npcContact = state.contacts.find(c => c.layer === "npc");

      // Check if this NPC is seeking or in seek-and-destroy mode
      const seek = world.getComponent<SeekBehavior>(entityId, SEEK_BEHAVIOR);
      const isSeeking = seek?.state === "seeking" || seek?.state === "seek-and-destroy";

      // Hard collision with block - always revert
      if (blockContact) {
        // Revert position
        pos.x = movement.prevX;
        pos.z = movement.prevZ;

        // Update mesh position
        const mesh = world.getObject3D(entityId);
        if (mesh) {
          mesh.position.x = pos.x;
          mesh.position.z = pos.z;
        }

        // Clear current path (it's now invalid)
        const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
        if (pf) {
          pf.path = [];
          pf.pathIndex = -1;
          pf.needsPath = false;
        }

        // If entity wanders, set wait time so it picks new target
        const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
        if (wander) {
          wander.waitTime = 0.2;
        }
      } else if (playerContact) {
        // Collision with player
        if (isSeeking) {
          // Seeking NPC reached player - just stop, don't clear path
          // The NPC has "caught" the player
          pos.x = movement.prevX;
          pos.z = movement.prevZ;

          const mesh = world.getObject3D(entityId);
          if (mesh) {
            mesh.position.x = pos.x;
            mesh.position.z = pos.z;
          }
          // Don't clear path - let SeekSystem handle pursuit logic
        } else {
          // Non-seeking entity hit player - revert and clear path
          pos.x = movement.prevX;
          pos.z = movement.prevZ;

          const mesh = world.getObject3D(entityId);
          if (mesh) {
            mesh.position.x = pos.x;
            mesh.position.z = pos.z;
          }

          const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
          if (pf) {
            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;
          }

          const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
          if (wander) {
            wander.waitTime = 0.5;
          }
        }
      } else if (npcContact) {
        // Soft collision with NPC - only intervene if deeply penetrating
        if (npcContact.penetration > 0.2) {
          // Nudge apart slightly
          const pushX = npcContact.normalX * npcContact.penetration * 0.5;
          const pushZ = npcContact.normalZ * npcContact.penetration * 0.5;
          pos.x += pushX;
          pos.z += pushZ;

          // Update mesh position
          const mesh = world.getObject3D(entityId);
          if (mesh) {
            mesh.position.x = pos.x;
            mesh.position.z = pos.z;
          }
        }
      }
    }
  };
}
