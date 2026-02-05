import * as THREE from "three";
import { onEvent, emitEvent } from "../core/EventBus";
import { BLOCK_GEOMETRY, BLOCK_MATERIALS } from "./BlockTypes";

/**
 * PlacementSystem - Handles placing and removing blocks
 *
 * Left-click: Place block on the face you're pointing at
 * Right-click: Remove the block you're pointing at
 */
export class PlacementSystem {
  private readonly scene: THREE.Scene;

  // Currently selected block type
  private selectedBlockType: string = "stone";

  // Store placed blocks: "x,y,z" -> Mesh
  private readonly placedBlocks: Map<string, THREE.Mesh> = new Map();

  // Currently hovered block info (from SelectionSystem)
  private hoveredBlock: { x: number; y: number; z: number } | null = null;
  private isHoveringGround: boolean = false;

  private isLeftMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;

  // Current build level (only place blocks at this Y level)
  private readonly buildLevel: number = 0; // ← ADD THIS

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for block hover events
    onEvent<{
      x: number;
      y: number;
      z: number;
      point: THREE.Vector3;
      isGround: boolean;
    }>("block:hovered", (data) => {
      this.hoveredBlock = { x: data.x, y: data.y, z: data.z };
      this.isHoveringGround = data.isGround;
    });

    onEvent("block:unhovered", () => {
      this.hoveredBlock = null;
      this.isHoveringGround = false;
    });

    // Listen for block type selection from BlockSelector UI
    onEvent<{ type: string }>("block:select", ({ type }) => {
      this.setSelectedBlockType(type);
    });

    // Listen for mouse clicks
    globalThis.addEventListener("mousedown", (event) => {
      if (event.button === 0) this.isLeftMouseDown = true;
      if (event.button === 2) this.isRightMouseDown = true;
    });

    globalThis.addEventListener("mouseup", (event) => {
      if (event.button === 0) this.isLeftMouseDown = false;
      if (event.button === 2) this.isRightMouseDown = false;
    });

    // Prevent context menu on right-click
    globalThis.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  update(): void {
    if (this.isLeftMouseDown) {
      this.placeBlock();
    }
    if (this.isRightMouseDown) {
      this.removeBlock();
    }
  }

  private placeBlock(): void {
    if (!this.hoveredBlock) return;

    const newX = this.hoveredBlock.x;
    const newZ = this.hoveredBlock.z;
    const newY = this.buildLevel; // Always place at build level

    const key = `${newX},${newY},${newZ}`;

    // Don't place if block already exists there
    if (this.placedBlocks.has(key)) return;

    // Create the block mesh
    const material = BLOCK_MATERIALS.get(this.selectedBlockType);
    if (!material) return;

    const mesh = new THREE.Mesh(BLOCK_GEOMETRY, material);
    // Position block centered at grid position (add 0.5 because mesh is centered)
    mesh.position.set(newX, newY + 0.5, newZ);
    mesh.userData.isPlacedBlock = true;
    mesh.userData.blockType = this.selectedBlockType;
    mesh.userData.gridPosition = { x: newX, y: newY, z: newZ };

    this.scene.add(mesh);
    this.placedBlocks.set(key, mesh);

    // Emit event for other systems
    emitEvent("block:placed", {
      x: newX,
      y: newY,
      z: newZ,
      type: this.selectedBlockType,
    });
  }

  private removeBlock(): void {
    if (!this.hoveredBlock) return;

    const key = `${this.hoveredBlock.x},${this.buildLevel},${this.hoveredBlock.z}`;
    const block = this.placedBlocks.get(key);

    if (block) {
      this.scene.remove(block);
      this.placedBlocks.delete(key);
      emitEvent("block:removed", {
        x: this.hoveredBlock.x,
        y: this.buildLevel,
        z: this.hoveredBlock.z,
      });
    }
  }
  /**
   * Change the selected block type
   */
  setSelectedBlockType(typeId: string): void {
    if (BLOCK_MATERIALS.has(typeId)) {
      this.selectedBlockType = typeId;
      emitEvent("block:type-changed", { type: typeId });
    }
  }

  /**
   * Get currently selected block type
   */
  getSelectedBlockType(): string {
    return this.selectedBlockType;
  }

  /**
   * Get count of placed blocks
   */
  getPlacedBlockCount(): number {
    return this.placedBlocks.size;
  }
}
