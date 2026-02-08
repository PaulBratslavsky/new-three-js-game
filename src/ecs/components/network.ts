// Network-related components for multiplayer

export const PLAYER_IDENTITY = "PlayerIdentity";

/**
 * Identifies a player entity (local or remote)
 */
export interface PlayerIdentity {
  playerId: string;      // Unique player ID from server
  isLocal: boolean;      // true for local player, false for remote
  color: number;         // Player color (for mesh tinting)
  displayName: string;   // Player name
}

export const OWNERSHIP = "Ownership";

/**
 * Marks an entity as owned by a specific player.
 * Used by spawners and NPCs to determine friendly/enemy targeting.
 */
export interface Ownership {
  ownerId: string;       // Player ID who created this entity
}
