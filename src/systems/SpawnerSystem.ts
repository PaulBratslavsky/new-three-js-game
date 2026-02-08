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
import { onEvent } from "../core/EventBus";
import type { NetworkManager } from "../network/NetworkManager";

// Track NPCs by network ID for sync
const npcNetworkIds = new Map<string, number>(); // networkId -> entityId
let npcCounter = 0;

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

interface NetworkNPCData {
  npcId: string;
  spawnerId: string;
  ownerId: string;
  position: { x: number; y: number; z: number };
}

/**
 * SpawnerSystem - Creates NPC entities at walkable cells.
 *
 * Multiplayer:
 * - Only spawns NPCs for local player's spawners
 * - Broadcasts NPC spawns to server
 * - Receives and creates NPCs from other players
 */
export function createSpawnerSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  // Queue for network NPCs to spawn
  const networkNPCsToSpawn: NetworkNPCData[] = [];
  const networkNPCsToDestroy: string[] = [];

  // Listen for NPCs from other players
  onEvent<NetworkNPCData>("network:npc:spawned", (data) => {
    networkNPCsToSpawn.push(data);
  });

  onEvent<{ npcId: string }>("network:npc:destroyed", (data) => {
    networkNPCsToDestroy.push(data.npcId);
  });

  return (world: World, dt: number) => {
    const networkManager = world.getResource<NetworkManager>("networkManager");
    const localPlayerId = networkManager?.getLocalPlayerId() ?? "local";

    // Process network NPCs from other players
    while (networkNPCsToSpawn.length > 0) {
      const data = networkNPCsToSpawn.shift()!;

      // Skip if we already have this NPC
      if (npcNetworkIds.has(data.npcId)) continue;

      // Skip if this is our own NPC (we already created it)
      if (data.ownerId === localPlayerId) continue;

      // Create NPC for remote player
      const npcEntity = createNPC(world, scene, data.position.x, data.position.z, data.position.y, {
        spawnerEntityId: -1, // No local spawner
        originX: data.position.x,
        originZ: data.position.z,
        wanderRadius: 5,
        ownerId: data.ownerId,
      });

      npcNetworkIds.set(data.npcId, npcEntity);
    }

    // Process NPC destructions
    while (networkNPCsToDestroy.length > 0) {
      const npcId = networkNPCsToDestroy.shift()!;
      const entityId = npcNetworkIds.get(npcId);
      if (entityId !== undefined) {
        const mesh = world.getObject3D(entityId);
        if (mesh) scene.remove(mesh);
        world.destroyEntity(entityId);
        npcNetworkIds.delete(npcId);
      }
    }

    // Process local spawners
    const spawners = world.query(SPAWNER_DATA, POSITION);

    for (const spawnerId of spawners) {
      const spawner = world.getComponent<SpawnerData>(spawnerId, SPAWNER_DATA);
      const pos = world.getComponent<Position>(spawnerId, POSITION);
      if (!spawner || !pos) continue;

      // Only process spawners owned by local player
      if (spawner.ownerId !== localPlayerId && spawner.ownerId !== "local") {
        continue;
      }

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
          ownerId: spawner.ownerId,
        });

        spawner.spawnedNPCIds.add(npcEntity);

        // Send to network
        if (networkManager?.isConnected()) {
          const npcNetworkId = `${localPlayerId}_npc_${npcCounter++}`;
          npcNetworkIds.set(npcNetworkId, npcEntity);

          networkManager.sendNPCSpawned(npcNetworkId, `spawner_${pos.x},${pos.y},${pos.z}`, {
            x: spawnWorld.x,
            y: pos.y,
            z: spawnWorld.z,
          });
        }
      }
    }
  };
}
