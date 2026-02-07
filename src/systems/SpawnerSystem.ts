import * as THREE from "three";
import { World } from "../ecs/World";
import {
  SPAWNER_DATA,
  POSITION,
  type SpawnerData,
  type Position,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";
import { createNPC } from "../entities";

/**
 * Find a walkable cell near the spawner.
 * Returns cell coordinates (integers).
 */
function findWalkableSpawnCell(
  originX: number,
  originZ: number,
  radius: number
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  // Search outward from origin (skip radius 0 since spawner is there)
  for (let r = 1; r <= Math.ceil(radius); r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

        const cellX = originCell.x + dx;
        const cellZ = originCell.z + dz;

        if (!pathfinder.isBlocked(cellX, cellZ)) {
          return { x: cellX, z: cellZ };
        }
      }
    }
  }
  return null;
}

/**
 * SpawnerSystem - Creates NPC entities at walkable cells.
 */
export function createSpawnerSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    const spawners = world.query(SPAWNER_DATA, POSITION);

    for (const spawnerId of spawners) {
      const spawner = world.getComponent<SpawnerData>(spawnerId, SPAWNER_DATA);
      const pos = world.getComponent<Position>(spawnerId, POSITION);
      if (!spawner || !pos) continue;

      // Clean up dead NPCs
      for (const npcId of spawner.spawnedNPCIds) {
        if (!world.isAlive(npcId)) {
          spawner.spawnedNPCIds.delete(npcId);
        }
      }

      // Accumulate spawn timer
      spawner.timeSinceLastSpawn += dt;

      // Check if we should spawn
      if (
        spawner.timeSinceLastSpawn >= spawner.spawnInterval &&
        spawner.spawnedNPCIds.size < spawner.maxNPCs
      ) {
        spawner.timeSinceLastSpawn = 0;

        // Find walkable spawn cell
        const spawnCell = findWalkableSpawnCell(pos.x, pos.z, spawner.radius);
        if (!spawnCell) {
          continue; // No walkable cell found
        }

        // Convert cell to world position (cell center)
        const spawnWorld = Pathfinder.cellToWorld(spawnCell.x, spawnCell.z);

        // Create NPC entity using factory
        const npcEntity = createNPC(world, scene, spawnWorld.x, spawnWorld.z, pos.y, {
          spawnerEntityId: spawnerId,
          originX: pos.x,
          originZ: pos.z,
          wanderRadius: spawner.radius,
        });

        spawner.spawnedNPCIds.add(npcEntity);
      }
    }
  };
}
