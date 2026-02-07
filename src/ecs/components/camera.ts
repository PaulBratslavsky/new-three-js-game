// Camera component

export const CAMERA_STATE = "CameraState";

export interface CameraState {
  angle: number;
  moveSpeed: number;
  rotateSpeed: number;
  snapAngle: number;
  snapThreshold: number;
  lastEmittedX: number;
  lastEmittedZ: number;
}
