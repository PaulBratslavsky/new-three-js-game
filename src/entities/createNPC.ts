import * as THREE from "three";
import { World } from "../ecs/World";
import {
  POSITION,
  NPC_DATA,
  PATH_FOLLOWER,
  MOVEMENT_STATE,
  WANDER_BEHAVIOR,
  SEEK_BEHAVIOR,
  COLLIDER,
  COLLISION_STATE,
  type Position,
  type NPCData,
  type PathFollower,
  type MovementState,
  type WanderBehavior,
  type SeekBehavior,
  type Collider,
  type CollisionState,
} from "../ecs/components";
import { NPC_GEOMETRY, NPC_MATERIAL } from "../structures/BlockTypes";

// NPC component defaults
const NPC_DEFAULTS = {
  moveSpeed: 3,
  colliderRadius: 0.3,
  collidesWith: ["npc", "player"] as const,
  meshOffsetY: 0.4,
  // Wander defaults
  wander: {
    minWait: 0.5,
    maxWait: 1.5,
    initialWait: 0.5,
  },
  // Seek defaults
  seek: {
    detectionRadius: 4,
    pursuitSteps: 5,
    cooldownTime: 3,
    aggravationThreshold: 3,
    seekAndDestroyDuration: 10,
  },
};

export interface NPCOptions {
  spawnerEntityId: number;
  originX: number;
  originZ: number;
  wanderRadius: number;
  ownerId: string;  // Player ID who owns this NPC
}

/**
 * Creates an NPC entity with all required components.
 */
export function createNPC(
  world: World,
  scene: THREE.Scene,
  x: number,
  z: number,
  y: number,
  options: NPCOptions
): number {
  const entity = world.createEntity();

  // Position
  world.addComponent<Position>(entity, POSITION, { x, y, z });

  // NPC identity
  world.addComponent<NPCData>(entity, NPC_DATA, {
    spawnerEntityId: options.spawnerEntityId,
    facingAngle: 0,
    ownerId: options.ownerId,
  });

  // Wander behavior
  world.addComponent<WanderBehavior>(entity, WANDER_BEHAVIOR, {
    originX: options.originX,
    originZ: options.originZ,
    radius: options.wanderRadius,
    waitTime: NPC_DEFAULTS.wander.initialWait,
    minWait: NPC_DEFAULTS.wander.minWait,
    maxWait: NPC_DEFAULTS.wander.maxWait,
  });

  // Seek behavior
  world.addComponent<SeekBehavior>(entity, SEEK_BEHAVIOR, {
    state: "idle",
    detectionRadius: NPC_DEFAULTS.seek.detectionRadius,
    pursuitSteps: NPC_DEFAULTS.seek.pursuitSteps,
    stepsRemaining: 0,
    cooldownTime: NPC_DEFAULTS.seek.cooldownTime,
    cooldownRemaining: 0,
    lastPlayerCellX: 0,
    lastPlayerCellZ: 0,
    aggravationCount: 0,
    aggravationThreshold: NPC_DEFAULTS.seek.aggravationThreshold,
    seekAndDestroyDuration: NPC_DEFAULTS.seek.seekAndDestroyDuration,
    seekAndDestroyRemaining: 0,
  });

  // Movement tracking
  world.addComponent<MovementState>(entity, MOVEMENT_STATE, {
    prevX: x,
    prevZ: z,
  });

  // Pathfinding
  world.addComponent<PathFollower>(entity, PATH_FOLLOWER, {
    path: [],
    pathIndex: -1,
    targetX: x,
    targetZ: z,
    moveSpeed: NPC_DEFAULTS.moveSpeed,
    needsPath: false,
    pathRetryTime: 0,
  });

  // Collision
  world.addComponent<Collider>(entity, COLLIDER, {
    type: "circle",
    width: 0,
    height: 0,
    depth: 0,
    radius: NPC_DEFAULTS.colliderRadius,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    layer: "npc",
    collidesWith: new Set(NPC_DEFAULTS.collidesWith),
  });

  world.addComponent<CollisionState>(entity, COLLISION_STATE, {
    contacts: [],
    isColliding: false,
  });

  // Mesh - use shared material (swap to NPC_MATERIAL_SEEKING when chasing)
  const mesh = new THREE.Mesh(NPC_GEOMETRY, NPC_MATERIAL);
  mesh.position.set(x, y + NPC_DEFAULTS.meshOffsetY, z);
  scene.add(mesh);
  world.setObject3D(entity, mesh);

  return entity;
}
