// Game state components

export const BLOCK_DATA = "BlockData";
export const HOVER_TARGET = "HoverTarget";
export const HIGHLIGHT_TAG = "HighlightTag";
export const GAME_STATE = "GameState";

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
