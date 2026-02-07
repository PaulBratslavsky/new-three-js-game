import * as THREE from "three";
import { World } from "../ecs/World";
import {
  SPAWNER_DATA,
  NPC_DATA,
  POSITION,
  COLLIDER,
  COLLISION_STATE,
  PATH_FOLLOWER,
  type SpawnerData,
  type NPCData,
  type Position,
  type Collider,
  type CollisionState,
  type PathFollower,
} from "../ecs/components";
import { NPC_GEOMETRY, NPC_MATERIAL } from "../structures/BlockTypes";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

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

        // Create NPC entity
        const npcEntity = world.createEntity();

        // Position at cell center
        world.addComponent<Position>(npcEntity, POSITION, {
          x: spawnWorld.x,
          y: pos.y,
          z: spawnWorld.z,
        });

        // NPC behavior data
        world.addComponent<NPCData>(npcEntity, NPC_DATA, {
          spawnerEntityId: spawnerId,
          originX: pos.x,
          originZ: pos.z,
          radius: spawner.radius,
          targetX: spawnWorld.x,
          targetZ: spawnWorld.z,
          facingAngle: 0,
          waitTime: 0.5, // Wait before first move
          prevX: spawnWorld.x,
          prevZ: spawnWorld.z,
        });

        // PathFollower for movement
        world.addComponent<PathFollower>(npcEntity, PATH_FOLLOWER, {
          path: [],
          pathIndex: -1,
          targetX: spawnWorld.x,
          targetZ: spawnWorld.z,
          moveSpeed: 3,
          needsPath: false,
          pathRetryTime: 0,
        });

        // Collision (NPC-NPC only)
        world.addComponent<Collider>(npcEntity, COLLIDER, {
          type: "circle",
          width: 0,
          height: 0,
          depth: 0,
          radius: 0.3,
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          layer: "npc",
          collidesWith: new Set(["npc"]),
        });
        world.addComponent<CollisionState>(npcEntity, COLLISION_STATE, {
          contacts: [],
          isColliding: false,
        });

        // Create mesh at cell center
        const mesh = new THREE.Mesh(NPC_GEOMETRY, NPC_MATERIAL);
        mesh.position.set(spawnWorld.x, pos.y + 0.4, spawnWorld.z);
        scene.add(mesh);
        world.setObject3D(npcEntity, mesh);

        spawner.spawnedNPCIds.add(npcEntity);
      }
    }
  };
}
