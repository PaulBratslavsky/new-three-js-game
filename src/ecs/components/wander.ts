// Wander behavior component - AI wandering within an area

export const WANDER_BEHAVIOR = "WanderBehavior";

/**
 * AI behavior for wandering within a radius.
 * Only add to entities that should wander (NPCs, not players).
 * The NPCMovementSystem checks for this component before applying wander logic.
 */
export interface WanderBehavior {
  originX: number;      // Center of wander area (X)
  originZ: number;      // Center of wander area (Z)
  radius: number;       // Maximum wander distance from origin
  waitTime: number;     // Current wait timer (0 = ready to move)
  minWait: number;      // Minimum wait at destination
  maxWait: number;      // Maximum wait at destination
}
