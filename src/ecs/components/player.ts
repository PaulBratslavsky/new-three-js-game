// Player component - identifies the player entity

export const PLAYER_DATA = "PlayerData";

/**
 * Identifies an entity as the player.
 * Movement comes from OTHER components:
 * - PathFollower: click-to-move pathfinding
 * - MovementState: collision position tracking
 * - Collider: collision detection
 *
 * Player does NOT have WanderBehavior (controlled by input, not AI).
 */
export interface PlayerData {
  facingAngle: number;  // Visual rotation (radians)
}
