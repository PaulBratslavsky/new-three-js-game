// Spawner component

export const SPAWNER_DATA = "SpawnerData";

export interface SpawnerData {
  radius: number;             // Wander radius (configurable, default 5)
  maxNPCs: number;            // Max NPCs to spawn (configurable)
  spawnedNPCIds: Set<number>; // Track spawned NPC entity IDs
  spawnInterval: number;      // Seconds between spawns (default 2)
  timeSinceLastSpawn: number; // Accumulator for spawn timing
}
