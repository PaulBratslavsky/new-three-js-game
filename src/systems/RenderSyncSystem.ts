import { World } from "../ecs/World";
import {
  POSITION,
  BLOCK_DATA,
  type Position,
} from "../ecs/components";

export function createRenderSyncSystem(): (world: World, dt: number) => void {
  return (world: World, _dt: number) => {
    const blockEntities = world.query(POSITION, BLOCK_DATA);

    for (const id of blockEntities) {
      const pos = world.getComponent<Position>(id, POSITION);
      const mesh = world.getObject3D(id);
      if (pos && mesh) {
        mesh.position.set(pos.x, pos.y + 0.5, pos.z);
      }
    }
  };
}
