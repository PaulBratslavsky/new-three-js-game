import * as THREE from "three";
import { World } from "../ecs/World";
import {
  MOUSE_STATE,
  HOVER_TARGET,
  POSITION,
  CAMERA_ENTITY,
  GAME_STATE_ENTITY,
  HIGHLIGHT_ENTITY,
  type MouseState,
  type HoverTarget,
  type Position,
} from "../ecs/components";

export function createSelectionSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  const raycaster = new THREE.Raycaster();
  const mouseVec = new THREE.Vector2();

  return (world: World, _dt: number) => {
    const mouse = world.getComponent<MouseState>(GAME_STATE_ENTITY, MOUSE_STATE);
    if (!mouse) return;

    const cameraObj = world.getObject3D(CAMERA_ENTITY) as THREE.PerspectiveCamera | undefined;
    if (!cameraObj) return;

    mouseVec.set(mouse.ndcX, mouse.ndcY);
    raycaster.setFromCamera(mouseVec, cameraObj);

    const intersects = raycaster.intersectObjects(scene.children, false);
    const validHits = intersects.filter(
      (hit) =>
        hit.object.userData.isHitTarget === true ||
        hit.object.userData.isPlacedBlock === true
    );

    const highlightObj = world.getObject3D(HIGHLIGHT_ENTITY) as THREE.Mesh | undefined;

    if (validHits.length > 0) {
      const hit = validHits[0];
      const gridPos = hit.object.userData.gridPosition;
      const isGround = hit.object.userData.isHitTarget === true;

      if (gridPos) {
        // Add or update HoverTarget on game state entity
        const hover: HoverTarget = {
          x: gridPos.x,
          y: gridPos.y,
          z: gridPos.z,
          isGround,
        };
        world.addComponent(GAME_STATE_ENTITY, HOVER_TARGET, hover);

        // Position highlight mesh
        if (highlightObj) {
          highlightObj.position.set(gridPos.x, gridPos.y + 0.5, gridPos.z);
          highlightObj.visible = true;
        }

        // Update highlight entity Position component
        const hlPos = world.getComponent<Position>(HIGHLIGHT_ENTITY, POSITION);
        if (hlPos) {
          hlPos.x = gridPos.x;
          hlPos.y = gridPos.y;
          hlPos.z = gridPos.z;
        }
      }
    } else {
      // Remove HoverTarget when nothing is hovered
      if (world.hasComponent(GAME_STATE_ENTITY, HOVER_TARGET)) {
        world.removeComponent(GAME_STATE_ENTITY, HOVER_TARGET);
      }

      if (highlightObj) {
        highlightObj.visible = false;
      }
    }
  };
}
