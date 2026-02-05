import * as THREE from "three";
import { World } from "../ecs/World";
import {
  MOUSE_STATE,
  HOVER_TARGET,
  GAME_STATE,
  POSITION,
  BLOCK_DATA,
  GAME_STATE_ENTITY,
  type MouseState,
  type HoverTarget,
  type GameState,
  type Position,
  type BlockData,
} from "../ecs/components";
import { BLOCK_GEOMETRY, BLOCK_MATERIALS } from "../structures/BlockTypes";
import { emitEvent, onEvent } from "../core/EventBus";

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
  mesh.position.set(newX, newY + 0.5, newZ);
  mesh.userData.isPlacedBlock = true;
  mesh.userData.blockType = gs.selectedBlockType;
  mesh.userData.gridPosition = { x: newX, y: newY, z: newZ };
  scene.add(mesh);

  // Create block entity
  const blockEntity = world.createEntity();
  world.addComponent<Position>(blockEntity, POSITION, { x: newX, y: newY, z: newZ });
  world.addComponent<BlockData>(blockEntity, BLOCK_DATA, { blockType: gs.selectedBlockType });
  world.setObject3D(blockEntity, mesh);

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

  const mesh = world.getObject3D(blockEntity);
  if (mesh) scene.remove(mesh);

  world.destroyEntity(blockEntity);
  gs.placedBlockKeys.delete(key);

  emitEvent("block:removed", {
    x: hover.x,
    y: gs.buildLevel,
    z: hover.z,
  });
}
