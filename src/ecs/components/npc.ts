// NPC identity component - marks an entity as an NPC

export const NPC_DATA = "NPCData";

/**
 * Identifies an entity as an NPC spawned from a spawner.
 * Behavior comes from OTHER components:
 * - WanderBehavior: AI wandering logic
 * - PathFollower: pathfinding and movement
 * - MovementState: collision position tracking
 * - Collider: collision detection
 */
export interface NPCData {
  spawnerEntityId: number;  // Parent spawner (for cleanup on spawner removal)
  facingAngle: number;      // Visual rotation (radians)
}
