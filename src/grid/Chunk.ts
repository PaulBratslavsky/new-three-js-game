import * as THREE from "three";

export const CHUNK_SIZE = 8;

export class Chunk {
  readonly chunkX: number;
  readonly chunkZ: number;

  private readonly scene: THREE.Scene;
  private readonly blocks: THREE.Object3D[] = [];  // Changed to Object3D to hold both types

  // Shared geometry and material for visuals
  private readonly edgeGeometry: THREE.EdgesGeometry;
  private readonly edgeMaterial: THREE.LineBasicMaterial;

  // Shared geometry and material for hit detection
  private readonly hitGeometry: THREE.PlaneGeometry;
  private readonly hitMaterial: THREE.MeshBasicMaterial;

  constructor(
    chunkX: number,
    chunkZ: number,
    scene: THREE.Scene,
    edgeGeometry: THREE.EdgesGeometry,
    edgeMaterial: THREE.LineBasicMaterial,
    hitGeometry: THREE.PlaneGeometry,      // ← NEW
    hitMaterial: THREE.MeshBasicMaterial   // ← NEW
  ) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.scene = scene;
    this.edgeGeometry = edgeGeometry;
    this.edgeMaterial = edgeMaterial;
    this.hitGeometry = hitGeometry;
    this.hitMaterial = hitMaterial;

    this.create();
  }

  private create(): void {
    const startX = this.chunkX * CHUNK_SIZE;
    const startZ = this.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = startX + x;
        const worldZ = startZ + z;

        // Visual: the cyan edge lines
        const visual = new THREE.LineSegments(
          this.edgeGeometry,
          this.edgeMaterial
        );
        visual.position.set(worldX, 0, worldZ);
        this.scene.add(visual);
        this.blocks.push(visual);

        // Hit target: invisible plane for raycasting
        const hitTarget = new THREE.Mesh(
          this.hitGeometry,
          this.hitMaterial
        );
        hitTarget.position.set(worldX, 0, worldZ);
        hitTarget.userData.isHitTarget = true;  // Mark for identification
        hitTarget.userData.gridPosition = { x: worldX, y: 0, z: worldZ };
        this.scene.add(hitTarget);
        this.blocks.push(hitTarget);
      }
    }
  }

  dispose(): void {
    for (const block of this.blocks) {
      this.scene.remove(block);
    }
    this.blocks.length = 0;
  }
}