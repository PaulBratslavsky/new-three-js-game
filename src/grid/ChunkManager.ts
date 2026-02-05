import * as THREE from "three";
import { Chunk, CHUNK_SIZE } from "./Chunk";
import { onEvent } from "../core/EventBus";

export class ChunkManager {
  private readonly scene: THREE.Scene;
  private readonly renderDistance: number;
  private readonly chunks: Map<string, Chunk> = new Map();

  // Shared geometry and material for visuals
  private readonly edgeGeometry: THREE.EdgesGeometry;
  private readonly edgeMaterial: THREE.LineBasicMaterial;

  // Shared geometry and material for hit detection           
  private readonly hitGeometry: THREE.PlaneGeometry;          
  private readonly hitMaterial: THREE.MeshBasicMaterial;     

  constructor(scene: THREE.Scene, renderDistance: number = 2) {
    this.scene = scene;
    this.renderDistance = renderDistance;

    // Create shared visual geometry
    const groundGeometry = new THREE.PlaneGeometry(1, 1);
    groundGeometry.rotateX(-Math.PI / 2);
    this.edgeGeometry = new THREE.EdgesGeometry(groundGeometry);
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffff,
    });

    // Create shared hit geometry (invisible)                 // ← NEW
    this.hitGeometry = new THREE.PlaneGeometry(1, 1);         // ← NEW
    this.hitGeometry.rotateX(-Math.PI / 2);                   // ← NEW
    this.hitMaterial = new THREE.MeshBasicMaterial({          // ← NEW
      visible: false,  // Invisible! Only for raycasting      // ← NEW
    });                                                        // ← NEW

    this.setupEventListeners();
    this.updateChunks(0, 0);
  }

  private setupEventListeners(): void {
    onEvent<{ x: number; z: number }>("camera:moved", ({ x, z }) => {
      this.updateChunks(x, z);
    });
  }

  private worldToChunk(worldX: number, worldZ: number): { chunkX: number; chunkZ: number } {
    return {
      chunkX: Math.floor(worldX / CHUNK_SIZE),
      chunkZ: Math.floor(worldZ / CHUNK_SIZE),
    };
  }

  private chunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  private updateChunks(cameraX: number, cameraZ: number): void {
    const { chunkX: centerX, chunkZ: centerZ } = this.worldToChunk(cameraX, cameraZ);
    const chunksToKeep = new Set<string>();

    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const chunkX = centerX + dx;
        const chunkZ = centerZ + dz;
        const key = this.chunkKey(chunkX, chunkZ);

        chunksToKeep.add(key);

        if (!this.chunks.has(key)) {
          this.loadChunk(chunkX, chunkZ);
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!chunksToKeep.has(key)) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  private loadChunk(chunkX: number, chunkZ: number): void {
    const key = this.chunkKey(chunkX, chunkZ);
    const chunk = new Chunk(
      chunkX,
      chunkZ,
      this.scene,
      this.edgeGeometry,
      this.edgeMaterial,
      this.hitGeometry,    // ← NEW
      this.hitMaterial     // ← NEW
    );
    this.chunks.set(key, chunk);
  }

  private unloadChunk(key: string, chunk: Chunk): void {
    chunk.dispose();
    this.chunks.delete(key);
  }

  getLoadedChunkCount(): number {
    return this.chunks.size;
  }
}