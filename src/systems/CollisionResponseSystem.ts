import { World } from "../ecs/World";
import {
  COLLISION_STATE,
  NPC_DATA,
  POSITION,
  type CollisionState,
  type NPCData,
  type Position,
} from "../ecs/components";

// Pick a new target for NPC, avoiding the collision direction
function pickNewTargetAwayFrom(
  npc: NPCData,
  normalX: number,
  normalZ: number
): void {
  // Generate random angle, but bias away from collision normal
  const avoidAngle = Math.atan2(normalZ, normalX);

  // Pick angle in opposite semicircle (±90° to ±180° from collision)
  const offset = (Math.PI / 2 + Math.random() * Math.PI) * (Math.random() < 0.5 ? 1 : -1);
  const newAngle = avoidAngle + Math.PI + offset;

  const targetDistance = Math.random() * npc.radius * 0.5 + npc.radius * 0.25;
  npc.targetX = npc.originX + Math.cos(newAngle) * targetDistance;
  npc.targetZ = npc.originZ + Math.sin(newAngle) * targetDistance;
}

export function createCollisionResponseSystem(): (world: World, dt: number) => void {
  return (world: World, _dt: number) => {
    const npcs = world.query(NPC_DATA, POSITION, COLLISION_STATE);

    for (const npcId of npcs) {
      const state = world.getComponent<CollisionState>(npcId, COLLISION_STATE);
      if (!state?.isColliding) continue;

      const npc = world.getComponent<NPCData>(npcId, NPC_DATA);
      const pos = world.getComponent<Position>(npcId, POSITION);
      if (!npc || !pos) continue;

      // Check what we're colliding with
      const blockContact = state.contacts.find(c => c.layer === "block");
      const npcContact = state.contacts.find(c => c.layer === "npc");

      if (blockContact) {
        // Hard collision with block - revert position and pick new target
        pos.x = npc.prevX;
        pos.z = npc.prevZ;

        // Update mesh position
        const mesh = world.getObject3D(npcId);
        if (mesh) {
          mesh.position.x = pos.x;
          mesh.position.z = pos.z;
        }

        // Pick new target away from block
        pickNewTargetAwayFrom(npc, blockContact.normalX, blockContact.normalZ);
        npc.waitTime = 0.2;
      } else if (npcContact) {
        // Soft collision with NPC - steering handles most avoidance
        // Only intervene if deeply penetrating (steering failed)
        if (npcContact.penetration > 0.2) {
          // Nudge apart slightly
          const pushX = npcContact.normalX * npcContact.penetration * 0.5;
          const pushZ = npcContact.normalZ * npcContact.penetration * 0.5;
          pos.x += pushX;
          pos.z += pushZ;

          // Update mesh position
          const mesh = world.getObject3D(npcId);
          if (mesh) {
            mesh.position.x = pos.x;
            mesh.position.z = pos.z;
          }
        }
        // No wait time for NPC-NPC - let steering handle smooth flow
      }
    }
  };
}
