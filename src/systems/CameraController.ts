import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import { emitEvent } from "../core/EventBus";

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input: InputManager;

  private angle = 0;
  private readonly speed = 10;
  private readonly rotateSpeed = 2;
  private readonly snapAngle = Math.PI / 2;
  private readonly snapThreshold = 0.05;

  // Track if camera moved (to avoid emitting every frame)
  private lastX = 0;
  private lastZ = 0;

  constructor(camera: THREE.PerspectiveCamera, input: InputManager) {
    this.camera = camera;
    this.input = input;
    this.lastX = camera.position.x;
    this.lastZ = camera.position.z;
  }

  update(deltaTime: number): void {
    this.updateRotation(deltaTime);
    this.updateMovement(deltaTime);
    this.applyTransform();
    this.emitIfMoved();
  }

  private updateRotation(deltaTime: number): void {
    const isRotating = this.input.isAnyKeyPressed("q", "e");

    if (this.input.isKeyPressed("q")) {
      this.angle += this.rotateSpeed * deltaTime;
    }
    if (this.input.isKeyPressed("e")) {
      this.angle -= this.rotateSpeed * deltaTime;
    }

    if (!isRotating) {
      const nearestSnap = Math.round(this.angle / this.snapAngle) * this.snapAngle;
      if (Math.abs(this.angle - nearestSnap) < this.snapThreshold) {
        this.angle = nearestSnap;
      }
    }
  }

  private updateMovement(deltaTime: number): void {
    const forward = new THREE.Vector3(
      -Math.sin(this.angle),
      0,
      -Math.cos(this.angle)
    );
    const right = new THREE.Vector3(
      Math.cos(this.angle),
      0,
      -Math.sin(this.angle)
    );

    const movement = new THREE.Vector3(0, 0, 0);

    if (this.input.isKeyPressed("w")) movement.add(forward);
    if (this.input.isKeyPressed("s")) movement.sub(forward);
    if (this.input.isKeyPressed("a")) movement.sub(right);
    if (this.input.isKeyPressed("d")) movement.add(right);

    if (movement.length() > 0) {
      movement.normalize().multiplyScalar(this.speed * deltaTime);
      this.camera.position.x += movement.x;
      this.camera.position.z += movement.z;
    }
  }

  private applyTransform(): void {
    this.camera.up.set(-Math.sin(this.angle), 0, -Math.cos(this.angle));
    this.camera.lookAt(
      this.camera.position.x,
      0,
      this.camera.position.z
    );
  }

  private emitIfMoved(): void {
    const x = this.camera.position.x;
    const z = this.camera.position.z;

    // Only emit if position actually changed
    if (x !== this.lastX || z !== this.lastZ) {
      emitEvent("camera:moved", { x, z });
      this.lastX = x;
      this.lastZ = z;
    }
  }

  getAngle(): number {
    return this.angle;
  }

  getPosition(): THREE.Vector3 {
    return this.camera.position.clone();
  }
}