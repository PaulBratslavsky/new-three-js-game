import * as THREE from "three";
import { emitEvent } from "../core/EventBus";

/**
 * SelectionSystem - Raycasts from camera through mouse to find blocks
 *
 * Emits "block:hovered" when mouse hovers over a block
 * Emits "block:unhovered" when mouse leaves a block
 */
export class SelectionSystem {
  private readonly camera: THREE.Camera;
  private readonly scene: THREE.Scene;
  private readonly raycaster: THREE.Raycaster;
  private readonly mouse: THREE.Vector2;

  // Currently hovered block position (null if none)
  private hoveredPosition: { x: number; y: number; z: number } | null = null;

  // Visual highlight for selected block
  private readonly highlightMesh: THREE.Mesh;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Create highlight cube (slightly larger than blocks)
    const highlightGeometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track mouse movement
    globalThis.addEventListener("mousemove", (event) => {
      this.updateMousePosition(event);
    });
  }

  private updateMousePosition(event: MouseEvent): void {
    // Convert to normalized device coordinates (-1 to 1)
    this.mouse.x = (event.clientX / globalThis.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / globalThis.innerHeight) * 2 + 1;
  }

  /**
   * Call this every frame to update selection
   */
  update(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(
      this.scene.children,
      false
    );

    const validHits = intersects.filter(
      (hit) =>
        hit.object.userData.isHitTarget === true ||
        hit.object.userData.isPlacedBlock === true
    );

    if (validHits.length > 0) {
      const hit = validHits[0];
      const gridPos = hit.object.userData.gridPosition;
      const faceNormal = hit.face?.normal;
      const isGround = hit.object.userData.isHitTarget === true; // ← ADD THIS LINE

      if (gridPos) {
        this.onBlockHovered(gridPos, hit.point, faceNormal, isGround); // ← ADD isGround
      }
    } else {
      this.onBlockUnhovered();
    }
  }

  private onBlockHovered(
    gridPos: { x: number; y: number; z: number },
    point: THREE.Vector3,
    faceNormal?: THREE.Vector3,
    isGround: boolean = false
  ): void {
    // Only emit if this is a different block than before
    const posKey = `${gridPos.x},${gridPos.y},${gridPos.z}`;
    const prevKey = this.hoveredPosition
      ? `${this.hoveredPosition.x},${this.hoveredPosition.y},${this.hoveredPosition.z}`
      : null;

    if (posKey !== prevKey) {
      this.hoveredPosition = gridPos;

      // Position highlight at block location
      this.highlightMesh.position.set(gridPos.x, gridPos.y + 0.5, gridPos.z);
      this.highlightMesh.visible = true;

      // Emit event with block info

      emitEvent("block:hovered", {
        x: gridPos.x,
        y: gridPos.y,
        z: gridPos.z,
        point: point.clone(),
        faceNormal: faceNormal?.clone(),
        isGround, // ← ADD THIS
      });
    }
  }

  private onBlockUnhovered(): void {
    if (this.hoveredPosition !== null) {
      this.hoveredPosition = null;
      this.highlightMesh.visible = false;

      emitEvent("block:unhovered", {});
    }
  }

  /**
   * Get the currently hovered block position, or null
   */
  getHoveredPosition(): { x: number; y: number; z: number } | null {
    return this.hoveredPosition;
  }
}
