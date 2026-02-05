import * as THREE from "three";
import { World } from "../ecs/World";
import {
  POSITION,
  CAMERA_STATE,
  INPUT_STATE,
  CAMERA_ENTITY,
  GAME_STATE_ENTITY,
  type Position,
  type CameraState,
  type InputState,
} from "../ecs/components";
import { emitEvent } from "../core/EventBus";

export function createCameraMovementSystem(): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    const pos = world.getComponent<Position>(CAMERA_ENTITY, POSITION);
    const cam = world.getComponent<CameraState>(CAMERA_ENTITY, CAMERA_STATE);
    const input = world.getComponent<InputState>(GAME_STATE_ENTITY, INPUT_STATE);
    if (!pos || !cam || !input) return;

    const keys = input.keysPressed;

    // --- Rotation ---
    const isRotating = keys.has("q") || keys.has("e");
    if (keys.has("q")) cam.angle += cam.rotateSpeed * dt;
    if (keys.has("e")) cam.angle -= cam.rotateSpeed * dt;

    if (!isRotating) {
      const nearestSnap = Math.round(cam.angle / cam.snapAngle) * cam.snapAngle;
      if (Math.abs(cam.angle - nearestSnap) < cam.snapThreshold) {
        cam.angle = nearestSnap;
      }
    }

    // --- Movement ---
    const forward = new THREE.Vector3(
      -Math.sin(cam.angle),
      0,
      -Math.cos(cam.angle)
    );
    const right = new THREE.Vector3(
      Math.cos(cam.angle),
      0,
      -Math.sin(cam.angle)
    );

    const movement = new THREE.Vector3(0, 0, 0);
    if (keys.has("w")) movement.add(forward);
    if (keys.has("s")) movement.sub(forward);
    if (keys.has("a")) movement.sub(right);
    if (keys.has("d")) movement.add(right);

    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(cam.moveSpeed * dt);
      pos.x += movement.x;
      pos.z += movement.z;
    }

    // --- Apply to Three.js camera ---
    const cameraObj = world.getObject3D(CAMERA_ENTITY) as THREE.PerspectiveCamera | undefined;
    if (cameraObj) {
      cameraObj.position.set(pos.x, pos.y, pos.z);
      cameraObj.up.set(-Math.sin(cam.angle), 0, -Math.cos(cam.angle));
      cameraObj.lookAt(pos.x, 0, pos.z);
    }

    // --- Emit if moved ---
    if (pos.x !== cam.lastEmittedX || pos.z !== cam.lastEmittedZ) {
      emitEvent("camera:moved", { x: pos.x, z: pos.z });
      cam.lastEmittedX = pos.x;
      cam.lastEmittedZ = pos.z;
    }
  };
}
