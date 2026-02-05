import * as THREE from "three";  

/**
 * All events in the game and their data types
 *
 * Naming convention: "domain:action"
 * Examples: "camera:moved", "block:placed", "player:joined"
 */

export interface CameraMoved {
  x: number;
  z: number;
}

export interface BlockPlaced {
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface WindowResized {
  width: number;
  height: number;
}

export interface BlockHovered {
  x: number;
  y: number;
  z: number;
  point: THREE.Vector3;    
  object: THREE.Object3D;
}

export interface BlockHovered {
  x: number;
  y: number;
  z: number;
  point: THREE.Vector3;
  faceNormal?: THREE.Vector3;  // ← NEW
}

export interface BlockPlaced {
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface BlockRemoved {
  x: number;
  y: number;
  z: number;
}

export interface BlockTypeChanged {
  type: string;
}

export interface BlockUnhovered {}

// Add more as you create new events...