// Input components

export const INPUT_STATE = "InputState";
export const MOUSE_STATE = "MouseState";

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
