import { World } from "../ecs/World";
import {
  PLAYER_DATA,
  PATH_FOLLOWER,
  POSITION,
  MOUSE_STATE,
  HOVER_TARGET,
  GAME_STATE,
  GAME_STATE_ENTITY,
  type PlayerData,
  type PathFollower,
  type MouseState,
  type HoverTarget,
  type GameState,
} from "../ecs/components";
import { Pathfinder } from "../core/Pathfinder";

/**
 * PlayerInputSystem - Handles player click-to-move input.
 *
 * When player clicks on a walkable cell:
 * 1. Sets PathFollower target to clicked position
 * 2. Requests path calculation
 *
 * Uses the same pathfinding as NPCs - only difference is input source.
 */
export function createPlayerInputSystem(): (world: World, dt: number) => void {
  return (world: World, _dt: number) => {
    // Get mouse and game state
    const mouse = world.getComponent<MouseState>(GAME_STATE_ENTITY, MOUSE_STATE);
    const gs = world.getComponent<GameState>(GAME_STATE_ENTITY, GAME_STATE);
    if (!mouse || !gs) return;

    // Only process movement in move mode, using left-click
    if (gs.mode !== "move" || !mouse.leftClicked) return;

    // Check if hovering over ground
    const hover = world.getComponent<HoverTarget>(GAME_STATE_ENTITY, HOVER_TARGET);
    if (!hover || !hover.isGround) return;

    // Find the player entity
    const players = world.query(PLAYER_DATA, PATH_FOLLOWER, POSITION);
    if (players.length === 0) return;

    const playerId = players[0];
    const pf = world.getComponent<PathFollower>(playerId, PATH_FOLLOWER);
    const player = world.getComponent<PlayerData>(playerId, PLAYER_DATA);
    if (!pf || !player) return;

    // Convert hover position to cell center
    const targetWorld = Pathfinder.cellToWorld(hover.x, hover.z);

    // Set target and request path
    pf.targetX = targetWorld.x;
    pf.targetZ = targetWorld.z;
    pf.needsPath = true;
  };
}
