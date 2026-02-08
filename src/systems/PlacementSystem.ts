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
import type { NetworkManager } from "../network/NetworkManager";

// Network block data type
interface NetworkBlockData {
  x: number;
  y: number;
  z: number;
  type: string;
  ownerId: string;
}

/**
 * PlacementSystem - Creates block entities with appropriate components.
 *
 * ECS Pattern:
 * - ALL blocks get: Position, BlockData, NavObstacle
 * - Spawner capability: add SpawnerData component
 * - Components define behavior, not string types
 *
 * Multiplayer:
 * - Sends block:placed/removed to server
 * - Listens for network:block:placed/removed from other players
 */
export function createPlacementSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  // Bridge block type selection from EventBus into ECS
  let pendingBlockType: string | null = null;
  onEvent<{ type: string }>("block:select", ({ type }) => {
    pendingBlockType = type;
  });

  // Queue for network blocks to place/remove
  const networkBlocksToPlace: NetworkBlockData[] = [];
  const networkBlocksToRemove: { x: number; y: number; z: number }[] = [];

  // Listen for blocks from other players
  onEvent<NetworkBlockData>("network:block:placed", (data) => {
    networkBlocksToPlace.push(data);
  });

  onEvent<{ x: number; y: number; z: number }>("network:block:removed", (data) => {
    networkBlocksToRemove.push(data);
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

    // Process network blocks (from other players)
    while (networkBlocksToPlace.length > 0) {
      const data = networkBlocksToPlace.shift()!;
      createBlockEntity(world, scene, gs, data.x, data.y, data.z, data.type, data.ownerId, false);
    }

    while (networkBlocksToRemove.length > 0) {
      const data = networkBlocksToRemove.shift()!;
      removeBlockAt(world, scene, gs, data.x, data.y, data.z, false);
    }

    const hasHover = world.hasComponent(GAME_STATE_ENTITY, HOVER_TARGET);

    // Only handle local placement in build mode
    if (gs.mode !== "build") return;

    // Place block on left click
    if (mouse.leftClicked && hasHover) {
      placeLocalBlock(world, scene, gs);
    }

    // Remove block on right click
    if (mouse.rightClicked && hasHover) {
      removeLocalBlock(world, scene, gs);
    }
  };
}

/**
 * Creates a block entity at the given position.
 * @param isLocal If true, send to network
 */
function createBlockEntity(
  world: World,
  scene: THREE.Scene,
  gs: GameState,
  x: number,
  y: number,
  z: number,
  blockType: string,
  ownerId: string,
  isLocal: boolean
): void {
  const key = `${x},${y},${z}`;

  if (gs.placedBlockKeys.has(key)) return;

  const material = BLOCK_MATERIALS.get(blockType);
  if (!material) return;

  const mesh = new THREE.Mesh(BLOCK_GEOMETRY, material);
  mesh.position.set(x, y + 0.5, z);
  mesh.userData.isPlacedBlock = true;
  mesh.userData.blockType = blockType;
  mesh.userData.gridPosition = { x, y, z };
  scene.add(mesh);

  // Create block entity
  const blockEntity = world.createEntity();

  // Core components
  world.addComponent<Position>(blockEntity, POSITION, { x, y, z });
  world.addComponent<BlockData>(blockEntity, BLOCK_DATA, { blockType });
  world.addComponent<NavObstacle>(blockEntity, NAV_OBSTACLE, {});
  world.setObject3D(blockEntity, mesh);

  // SpawnerData for spawner blocks
  if (blockType === "spawner") {
    world.addComponent<SpawnerData>(blockEntity, SPAWNER_DATA, {
      radius: 5,
      maxNPCs: 3,
      spawnedNPCIds: new Set(),
      spawnInterval: 2,
      timeSinceLastSpawn: 0,
      ownerId,
    });
  }

  gs.placedBlockKeys.set(key, blockEntity);

  // Send to network if local placement
  if (isLocal) {
    const networkManager = world.getResource<NetworkManager>("networkManager");
    if (networkManager?.isConnected()) {
      networkManager.sendBlockPlaced(x, y, z, blockType);
    }
  }

  emitEvent("block:placed", { x, y, z, type: blockType });
}

/**
 * Removes a block at the given position.
 * @param isLocal If true, send to network
 */
function removeBlockAt(
  world: World,
  scene: THREE.Scene,
  gs: GameState,
  x: number,
  y: number,
  z: number,
  isLocal: boolean
): void {
  const key = `${x},${y},${z}`;
  const blockEntity = gs.placedBlockKeys.get(key);

  if (blockEntity === undefined) return;

  // Clean up spawner NPCs
  const spawnerData = world.getComponent<SpawnerData>(blockEntity, SPAWNER_DATA);
  if (spawnerData) {
    for (const npcId of spawnerData.spawnedNPCIds) {
      const npcMesh = world.getObject3D(npcId);
      if (npcMesh) scene.remove(npcMesh);
      world.destroyEntity(npcId);
    }
    spawnerData.spawnedNPCIds.clear();
  }

  const mesh = world.getObject3D(blockEntity);
  if (mesh) scene.remove(mesh);

  world.destroyEntity(blockEntity);
  gs.placedBlockKeys.delete(key);

  // Send to network if local removal
  if (isLocal) {
    const networkManager = world.getResource<NetworkManager>("networkManager");
    if (networkManager?.isConnected()) {
      networkManager.sendBlockRemoved(x, y, z);
    }
  }

  emitEvent("block:removed", { x, y, z });
}

/**
 * Places a block at the hovered position (local player action).
 */
function placeLocalBlock(world: World, scene: THREE.Scene, gs: GameState): void {
  const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
  if (!hover) return;

  const networkManager = world.getResource<NetworkManager>("networkManager");
  const ownerId = networkManager?.getLocalPlayerId() ?? "local";

  createBlockEntity(world, scene, gs, hover.x, gs.buildLevel, hover.z, gs.selectedBlockType, ownerId, true);
}

/**
 * Removes a block at the hovered position (local player action).
 */
function removeLocalBlock(world: World, scene: THREE.Scene, gs: GameState): void {
  const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
  if (!hover) return;

  removeBlockAt(world, scene, gs, hover.x, gs.buildLevel, hover.z, true);
}
