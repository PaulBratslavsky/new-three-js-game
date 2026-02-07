// Collision components

export const COLLIDER = "Collider";
export const COLLISION_STATE = "CollisionState";

export type ColliderType = "box" | "circle";

export interface Collider {
  type: ColliderType;
  // Box dimensions (used when type === "box")
  width: number;   // X axis
  height: number;  // Y axis
  depth: number;   // Z axis
  // Circle radius (used when type === "circle", on XZ plane)
  radius: number;
  // Offset from entity position
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  // Collision filtering
  layer: "block" | "npc" | "player";  // What this entity is
  collidesWith: Set<string>;           // What layers it collides with
}

export interface CollisionContact {
  entityId: number;
  layer: string;
  normalX: number;
  normalZ: number;
  penetration: number;
}

export interface CollisionState {
  contacts: CollisionContact[];
  isColliding: boolean;
}
