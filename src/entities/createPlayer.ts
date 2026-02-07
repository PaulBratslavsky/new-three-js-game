import * as THREE from "three";
import { World } from "../ecs/World";
import {
  POSITION,
  PLAYER_DATA,
  PATH_FOLLOWER,
  MOVEMENT_STATE,
  COLLIDER,
  COLLISION_STATE,
  type Position,
  type PlayerData,
  type PathFollower,
  type MovementState,
  type Collider,
  type CollisionState,
} from "../ecs/components";

// Player visual configuration
const PLAYER_CONFIG = {
  geometry: () => {
    const geo = new THREE.ConeGeometry(0.35, 0.9, 4);
    geo.rotateX(Math.PI / 2);
    return geo;
  },
  material: new THREE.MeshStandardMaterial({ color: 0x0088ff }),
  meshOffsetY: 0.45,
};

// Player component defaults
const PLAYER_DEFAULTS = {
  moveSpeed: 4,
  colliderRadius: 0.3,
  collidesWith: ["npc", "block"] as const,
};

/**
 * Creates a player entity with all required components.
 */
export function createPlayer(
  world: World,
  scene: THREE.Scene,
  x: number,
  z: number,
  y: number = 0
): number {
  const entity = world.createEntity();

  // Position
  world.addComponent<Position>(entity, POSITION, { x, y, z });

  // Player identity
  world.addComponent<PlayerData>(entity, PLAYER_DATA, {
    facingAngle: 0,
  });

  // Pathfinding
  world.addComponent<PathFollower>(entity, PATH_FOLLOWER, {
    path: [],
    pathIndex: -1,
    targetX: x,
    targetZ: z,
    moveSpeed: PLAYER_DEFAULTS.moveSpeed,
    needsPath: false,
    pathRetryTime: 0,
  });

  // Movement tracking
  world.addComponent<MovementState>(entity, MOVEMENT_STATE, {
    prevX: x,
    prevZ: z,
  });

  // Collision
  world.addComponent<Collider>(entity, COLLIDER, {
    type: "circle",
    width: 0,
    height: 0,
    depth: 0,
    radius: PLAYER_DEFAULTS.colliderRadius,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    layer: "player",
    collidesWith: new Set(PLAYER_DEFAULTS.collidesWith),
  });

  world.addComponent<CollisionState>(entity, COLLISION_STATE, {
    contacts: [],
    isColliding: false,
  });

  // Mesh
  const mesh = new THREE.Mesh(PLAYER_CONFIG.geometry(), PLAYER_CONFIG.material);
  mesh.position.set(x, y + PLAYER_CONFIG.meshOffsetY, z);
  scene.add(mesh);
  world.setObject3D(entity, mesh);

  return entity;
}
