import * as THREE from "three";
import { World } from "../ecs/World";
import {
  MOUSE_STATE,
  HOVER_TARGET,
  GAME_STATE,
  POSITION,
  BLOCK_DATA,
  SPAWNER_DATA,
  NAV_OBSTACLE,
  GAME_STATE_ENTITY,
  type MouseState,
  type HoverTarget,
  type GameState,
  type Position,
  type BlockData,
  type SpawnerData,
  type NavObstacle,
} from "../ecs/components";
import { BLOCK_GEOMETRY, BLOCK_MATERIALS } from "../structures/BlockTypes";
import { emitEvent, onEvent } from "../core/EventBus";

/**
 * PlacementSystem - Creates block entities with appropriate components.
 *
 * ECS Pattern:
 * - ALL blocks get: Position, BlockData, NavObstacle
 * - Spawner capability: add SpawnerData component
 * - Components define behavior, not string types
 */
export function createPlacementSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  // Bridge block type selection from EventBus into ECS
  let pendingBlockType: string | null = null;
  onEvent<{ type: string }>("block:select", ({ type }) => {
    pendingBlockType = type;
  });

  return (world: World, _dt: number) => {
    const mouse = world.getComponent<MouseState>(GAME_STATE_ENTITY, MOUSE_STATE);
    const gs = world.getComponent<GameState>(GAME_STATE_ENTITY, GAME_STATE);
    if (!mouse || !gs) return;

    // Apply pending block type selection
    if (pendingBlockType !== null) {
      if (BLOCK_MATERIALS.has(pendingBlockType)) {
        gs.selectedBlockType = pendingBlockType;
        emitEvent("block:type-changed", { type: pendingBlockType });
      }
      pendingBlockType = null;
    }

    const hasHover = world.hasComponent(GAME_STATE_ENTITY, HOVER_TARGET);

    // Only handle placement in build mode
    if (gs.mode !== "build") return;

    // Place block on left click
    if (mouse.leftClicked && hasHover) {
      placeBlock(world, scene, gs);
    }

    // Remove block on right click
    if (mouse.rightClicked && hasHover) {
      removeBlock(world, scene, gs);
    }
  };
}

function placeBlock(world: World, scene: THREE.Scene, gs: GameState): void {
  const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
  if (!hover) return;

  const newX = hover.x;
  const newZ = hover.z;
  const newY = gs.buildLevel;
  const key = `${newX},${newY},${newZ}`;

  if (gs.placedBlockKeys.has(key)) return;

  const material = BLOCK_MATERIALS.get(gs.selectedBlockType);
  if (!material) return;

  const mesh = new THREE.Mesh(BLOCK_GEOMETRY, material);
  // Position at integer (cell center in this coordinate system)
  mesh.position.set(newX, newY + 0.5, newZ);
  mesh.userData.isPlacedBlock = true;
  mesh.userData.blockType = gs.selectedBlockType;
  mesh.userData.gridPosition = { x: newX, y: newY, z: newZ };
  scene.add(mesh);

  // === CREATE BLOCK ENTITY ===
  const blockEntity = world.createEntity();

  // Core components - ALL blocks have these
  world.addComponent<Position>(blockEntity, POSITION, { x: newX, y: newY, z: newZ });
  world.addComponent<BlockData>(blockEntity, BLOCK_DATA, { blockType: gs.selectedBlockType });
  world.addComponent<NavObstacle>(blockEntity, NAV_OBSTACLE, {}); // Blocks pathfinding
  world.setObject3D(blockEntity, mesh);

  // === OPTIONAL COMPONENTS based on block type ===
  // SpawnerData component makes this entity a spawner
  if (gs.selectedBlockType === "spawner") {
    world.addComponent<SpawnerData>(blockEntity, SPAWNER_DATA, {
      radius: 5,
      maxNPCs: 3,
      spawnedNPCIds: new Set(),
      spawnInterval: 2,
      timeSinceLastSpawn: 0,
    });
  }

  gs.placedBlockKeys.set(key, blockEntity);

  emitEvent("block:placed", {
    x: newX,
    y: newY,
    z: newZ,
    type: gs.selectedBlockType,
  });
}

function removeBlock(world: World, scene: THREE.Scene, gs: GameState): void {
  const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
  if (!hover) return;

  const key = `${hover.x},${gs.buildLevel},${hover.z}`;
  const blockEntity = gs.placedBlockKeys.get(key);

  if (blockEntity === undefined) return;

  // Check if entity HAS SpawnerData component (ECS way, not checking string type)
  const spawnerData = world.getComponent<SpawnerData>(blockEntity, SPAWNER_DATA);
  if (spawnerData) {
    // Clean up spawned NPCs
    for (const npcId of spawnerData.spawnedNPCIds) {
      const npcMesh = world.getObject3D(npcId);
      if (npcMesh) scene.remove(npcMesh);
      world.destroyEntity(npcId);
    }
    spawnerData.spawnedNPCIds.clear();
  }

  const mesh = world.getObject3D(blockEntity);
  if (mesh) scene.remove(mesh);

  // Destroying entity removes all components - NavObstacleSystem will handle pathfinder
  world.destroyEntity(blockEntity);
  gs.placedBlockKeys.delete(key);

  emitEvent("block:removed", {
    x: hover.x,
    y: gs.buildLevel,
    z: hover.z,
  });
}
