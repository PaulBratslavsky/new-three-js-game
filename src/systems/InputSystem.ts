import { World } from "../ecs/World";
import {
  INPUT_STATE,
  MOUSE_STATE,
  GAME_STATE_ENTITY,
  type InputState,
  type MouseState,
} from "../ecs/components";

export function createInputSystem(): (world: World, dt: number) => void {
  const keysPressed = new Set<string>();
  let ndcX = 0;
  let ndcY = 0;
  let leftDown = false;
  let rightDown = false;
  let leftClicked = false;
  let rightClicked = false;

  globalThis.addEventListener("keydown", (event) => {
    keysPressed.add(event.key.toLowerCase());
  });

  globalThis.addEventListener("keyup", (event) => {
    keysPressed.delete(event.key.toLowerCase());
  });

  globalThis.addEventListener("blur", () => {
    keysPressed.clear();
  });

  globalThis.addEventListener("mousemove", (event) => {
    ndcX = (event.clientX / globalThis.innerWidth) * 2 - 1;
    ndcY = -(event.clientY / globalThis.innerHeight) * 2 + 1;
  });

  globalThis.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
      leftDown = true;
      leftClicked = true;
    }
    if (event.button === 2) {
      rightDown = true;
      rightClicked = true;
    }
  });

  globalThis.addEventListener("mouseup", (event) => {
    if (event.button === 0) leftDown = false;
    if (event.button === 2) rightDown = false;
  });

  globalThis.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  return (world: World, _dt: number) => {
    // Write keyboard state
    const input = world.getComponent<InputState>(GAME_STATE_ENTITY, INPUT_STATE);
    if (input) {
      input.keysPressed.clear();
      for (const key of keysPressed) {
        input.keysPressed.add(key);
      }
    }

    // Write mouse state
    const mouse = world.getComponent<MouseState>(GAME_STATE_ENTITY, MOUSE_STATE);
    if (mouse) {
      mouse.ndcX = ndcX;
      mouse.ndcY = ndcY;
      mouse.leftDown = leftDown;
      mouse.rightDown = rightDown;
      mouse.leftClicked = leftClicked;
      mouse.rightClicked = rightClicked;

      // Clear one-shot click flags after writing
      leftClicked = false;
      rightClicked = false;
    }
  };
}
