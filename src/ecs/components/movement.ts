// Movement tracking component - for any entity that moves and needs collision revert

export const MOVEMENT_STATE = "MovementState";

/**
 * Tracks previous position for collision response.
 * Add to ANY entity that moves and might need position revert on collision.
 * Works for NPCs, players, projectiles, etc.
 */
export interface MovementState {
  prevX: number;
  prevZ: number;
}
