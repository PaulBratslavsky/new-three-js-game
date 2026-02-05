import { World } from "../ecs/World";
import {
  HOVER_TARGET,
  GAME_STATE_ENTITY,
  type HoverTarget,
} from "../ecs/components";
import { emitEvent } from "../core/EventBus";

export function createUISystem(): (world: World, dt: number) => void {
  let wasHovering = false;

  return (world: World, _dt: number) => {
    const isHovering = world.hasComponent(GAME_STATE_ENTITY, HOVER_TARGET);

    if (isHovering) {
      const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
      if (hover) {
        emitEvent("block:hovered", {
          x: hover.x,
          y: hover.y,
          z: hover.z,
        });
      }
      wasHovering = true;
    } else if (wasHovering) {
      emitEvent("block:unhovered", {});
      wasHovering = false;
    }
  };
}
