// --- Component name constants ---
export const POSITION = "Position";
export const CAMERA_STATE = "CameraState";
export const INPUT_STATE = "InputState";
export const MOUSE_STATE = "MouseState";
export const BLOCK_DATA = "BlockData";
export const HOVER_TARGET = "HoverTarget";
export const HIGHLIGHT_TAG = "HighlightTag";
export const GAME_STATE = "GameState";

// --- Component data interfaces ---

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  angle: number;
  moveSpeed: number;
  rotateSpeed: number;
  snapAngle: number;
  snapThreshold: number;
  lastEmittedX: number;
  lastEmittedZ: number;
}

export interface InputState {
  keysPressed: Set<string>;
}

export interface MouseState {
  ndcX: number;
  ndcY: number;
  leftDown: boolean;
  rightDown: boolean;
  leftClicked: boolean;
  rightClicked: boolean;
}

export interface BlockData {
  blockType: string;
}

export interface HoverTarget {
  x: number;
  y: number;
  z: number;
  isGround: boolean;
}

export interface HighlightTag {}

export interface GameState {
  selectedBlockType: string;
  buildLevel: number;
  placedBlockKeys: Map<string, number>; // "x,y,z" → entity ID
}

// --- Entity ID type alias ---
export type EntityId = number;

// --- Well-known entity IDs ---
export const CAMERA_ENTITY = 0;
export const GAME_STATE_ENTITY = 1;
export const HIGHLIGHT_ENTITY = 2;

// --- Component type map for generic lookups ---
export interface ComponentTypeMap {
  [POSITION]: Position;
  [CAMERA_STATE]: CameraState;
  [INPUT_STATE]: InputState;
  [MOUSE_STATE]: MouseState;
  [BLOCK_DATA]: BlockData;
  [HOVER_TARGET]: HoverTarget;
  [HIGHLIGHT_TAG]: HighlightTag;
  [GAME_STATE]: GameState;
}
