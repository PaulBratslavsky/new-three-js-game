import { World } from "../ecs/World";
import { POSITION, CAMERA_ENTITY, type Position } from "../ecs/components";
import { ChunkManager } from "../grid/ChunkManager";

export function createChunkLoadingSystem(
  chunkManager: ChunkManager
): (world: World, dt: number) => void {
  return (world: World, _dt: number) => {
    const pos = world.getComponent<Position>(CAMERA_ENTITY, POSITION);
    if (!pos) return;

    chunkManager.updateChunks(pos.x, pos.z);
  };
}
