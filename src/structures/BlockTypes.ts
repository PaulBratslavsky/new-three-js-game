import * as THREE from "three";

/**
 * Block type definitions
 * Each block type has a unique material
 */
export interface BlockType {
  id: string;
  name: string;
  color: number;
  metalness: number;
  roughness: number;
}

// Available block types
export const BLOCK_TYPES: BlockType[] = [
  {
    id: "stone",
    name: "Stone",
    color: 0x808080,
    metalness: 0.1,
    roughness: 0.8,
  },
  {
    id: "grass",
    name: "Grass",
    color: 0x44aa44,
    metalness: 0,
    roughness: 0.9,
  },
  { id: "dirt", name: "Dirt", color: 0x8b4513, metalness: 0, roughness: 1 },
  { id: "wood", name: "Wood", color: 0xdeb887, metalness: 0, roughness: 0.7 },
  { id: "gold", name: "Gold", color: 0xffd700, metalness: 0.9, roughness: 0.1 },
];

// Create materials for each block type (shared across all blocks)
export const BLOCK_MATERIALS: Map<string, THREE.MeshStandardMaterial> =
  new Map();

for (const blockType of BLOCK_TYPES) {
  BLOCK_MATERIALS.set(
    blockType.id,
    new THREE.MeshStandardMaterial({
      color: blockType.color,
      metalness: blockType.metalness,
      roughness: blockType.roughness,
    })
  );
}

// Shared geometry for all placed blocks
export const BLOCK_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
