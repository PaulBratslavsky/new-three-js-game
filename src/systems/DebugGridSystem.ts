import * as THREE from "three";
import { World } from "../ecs/World";
import {
  POSITION,
  BLOCK_DATA,
  CAMERA_ENTITY,
  type Position,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";
import { onEvent } from "../core/EventBus";

const GRID_SIZE = 30;
const CELL_HEIGHT = 0.01;

/**
 * DebugGridSystem - Visualizes walkable/blocked cells
 *
 * Shows cells at their centers (where NPCs walk).
 * Blue = walkable, Red = blocked
 */
export function createDebugGridSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  let isVisible = false;
  let gridGroup: THREE.Group | null = null;
  let lastCameraX = -999;
  let lastCameraZ = -999;
  let needsRebuild = false;

  const walkableMaterial = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });

  const blockedMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });

  const cellGeometry = new THREE.PlaneGeometry(0.9, 0.9);
  cellGeometry.rotateX(-Math.PI / 2);

  onEvent("debug:toggle-grid", () => {
    isVisible = !isVisible;
    if (gridGroup) {
      gridGroup.visible = isVisible;
    }
    if (isVisible) {
      needsRebuild = true;
    }
  });

  onEvent("block:placed", () => {
    if (isVisible) needsRebuild = true;
  });
  onEvent("block:removed", () => {
    if (isVisible) needsRebuild = true;
  });

  let blocksHidden = false;
  onEvent<{ hidden: boolean }>("debug:toggle-blocks", ({ hidden }) => {
    blocksHidden = hidden;
  });

  function buildGrid(centerX: number, centerZ: number) {
    if (gridGroup) {
      scene.remove(gridGroup);
      gridGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }

    gridGroup = new THREE.Group();
    gridGroup.name = "DebugGrid";

    const centerCell = Pathfinder.worldToCell(centerX, centerZ);
    const startX = centerCell.x - GRID_SIZE;
    const endX = centerCell.x + GRID_SIZE;
    const startZ = centerCell.z - GRID_SIZE;
    const endZ = centerCell.z + GRID_SIZE;

    for (let cellX = startX; cellX <= endX; cellX++) {
      for (let cellZ = startZ; cellZ <= endZ; cellZ++) {
        const isBlocked = pathfinder.isBlocked(cellX, cellZ);
        const material = isBlocked ? blockedMaterial : walkableMaterial;

        const mesh = new THREE.Mesh(cellGeometry, material);
        // Position at cell center (where NPCs should walk)
        const worldPos = Pathfinder.cellToWorld(cellX, cellZ);
        mesh.position.set(worldPos.x, CELL_HEIGHT, worldPos.z);
        gridGroup.add(mesh);
      }
    }

    gridGroup.visible = isVisible;
    scene.add(gridGroup);

    lastCameraX = centerCell.x;
    lastCameraZ = centerCell.z;
  }

  return (world: World, _dt: number) => {
    // Toggle block visibility
    const blocks = world.query(BLOCK_DATA, POSITION);
    for (const blockId of blocks) {
      const mesh = world.getObject3D(blockId);
      if (mesh) {
        mesh.visible = !blocksHidden;
      }
    }

    if (!isVisible && !needsRebuild) return;

    const camPos = world.getComponent<Position>(CAMERA_ENTITY, POSITION);
    if (!camPos) return;

    const camCell = Pathfinder.worldToCell(camPos.x, camPos.z);

    const cameraMoved = Math.abs(camCell.x - lastCameraX) > 5 ||
                       Math.abs(camCell.z - lastCameraZ) > 5;

    if (needsRebuild || cameraMoved || !gridGroup) {
      buildGrid(camPos.x, camPos.z);
      needsRebuild = false;
    }
  };
}
