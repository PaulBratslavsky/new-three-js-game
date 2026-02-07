// Re-export all components from a single entry point

export * from "./core";
export * from "./camera";
export * from "./input";
export * from "./game";
export * from "./spawner";
export * from "./npc";
export * from "./pathfinding";
export * from "./collision";
export * from "./navigation";

// Import constants for ComponentTypeMap
import {
  POSITION,
  type Position,
} from "./core";
import {
  CAMERA_STATE,
  type CameraState,
} from "./camera";
import {
  INPUT_STATE,
  MOUSE_STATE,
  type InputState,
  type MouseState,
} from "./input";
import {
  BLOCK_DATA,
  HOVER_TARGET,
  HIGHLIGHT_TAG,
  GAME_STATE,
  type BlockData,
  type HoverTarget,
  type HighlightTag,
  type GameState,
} from "./game";
import {
  SPAWNER_DATA,
  type SpawnerData,
} from "./spawner";
import {
  NPC_DATA,
  type NPCData,
} from "./npc";
import {
  PATH_FOLLOWER,
  type PathFollower,
} from "./pathfinding";
import {
  COLLIDER,
  COLLISION_STATE,
  type Collider,
  type CollisionState,
} from "./collision";
import {
  NAV_OBSTACLE,
  type NavObstacle,
} from "./navigation";

// Component type map for generic lookups
export interface ComponentTypeMap {
  [POSITION]: Position;
  [CAMERA_STATE]: CameraState;
  [INPUT_STATE]: InputState;
  [MOUSE_STATE]: MouseState;
  [BLOCK_DATA]: BlockData;
  [HOVER_TARGET]: HoverTarget;
  [HIGHLIGHT_TAG]: HighlightTag;
  [GAME_STATE]: GameState;
  [SPAWNER_DATA]: SpawnerData;
  [NPC_DATA]: NPCData;
  [PATH_FOLLOWER]: PathFollower;
  [COLLIDER]: Collider;
  [COLLISION_STATE]: CollisionState;
  [NAV_OBSTACLE]: NavObstacle;
}
