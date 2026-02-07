// NPC component

export const NPC_DATA = "NPCData";

export interface NPCData {
  spawnerEntityId: number;  // Parent spawner
  originX: number;          // Spawner position (center of wander area)
  originZ: number;
  radius: number;           // Wander radius
  targetX: number;          // Final move target
  targetZ: number;
  facingAngle: number;      // Rotation for triangle mesh
  waitTime: number;         // Time to pause at target (0 = moving)
  prevX: number;            // Previous X position (for collision revert)
  prevZ: number;            // Previous Z position (for collision revert)
}
