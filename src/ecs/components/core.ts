// Core/common components

export const POSITION = "Position";

export interface Position {
  x: number;
  y: number;
  z: number;
}

// Entity ID type alias
export type EntityId = number;

// Well-known entity IDs
export const CAMERA_ENTITY = 0;
export const GAME_STATE_ENTITY = 1;
export const HIGHLIGHT_ENTITY = 2;
