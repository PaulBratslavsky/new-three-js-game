// Seek behavior component - NPC pursues player when in range

export const SEEK_BEHAVIOR = "SeekBehavior";

export type SeekState = "idle" | "seeking" | "cooldown" | "seek-and-destroy";

/**
 * SeekBehavior - Makes NPC pursue player when within detection radius.
 *
 * States:
 * - idle: Wandering normally, checking for player in range
 * - seeking: Actively pursuing player for N steps
 * - cooldown: Resting after pursuit before can seek again
 * - seek-and-destroy: Aggravated! Chases player's destination for 10 seconds
 */
export interface SeekBehavior {
  state: SeekState;
  detectionRadius: number;    // How close player must be to trigger (in cells)
  pursuitSteps: number;       // How many path steps to chase before stopping
  stepsRemaining: number;     // Steps left in current pursuit
  cooldownTime: number;       // How long to rest after pursuit (seconds)
  cooldownRemaining: number;  // Time left in cooldown
  lastPlayerCellX: number;    // Last known player cell X
  lastPlayerCellZ: number;    // Last known player cell Z
  // Seek-and-destroy
  aggravationCount: number;   // How many times player has triggered seeking
  aggravationThreshold: number; // Triggers seek-and-destroy at this count
  seekAndDestroyDuration: number; // How long to chase in seek-and-destroy (seconds)
  seekAndDestroyRemaining: number; // Time left in seek-and-destroy
}
