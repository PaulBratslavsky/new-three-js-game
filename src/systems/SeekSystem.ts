import * as THREE from "three";
import { World } from "../ecs/World";
import {
  SEEK_BEHAVIOR,
  PATH_FOLLOWER,
  POSITION,
  WANDER_BEHAVIOR,
  PLAYER_ENTITY,
  NPC_DATA,
  PLAYER_IDENTITY,
  type SeekBehavior,
  type PathFollower,
  type Position,
  type WanderBehavior,
  type NPCData,
  type PlayerIdentity,
} from "../ecs/components";
import { Pathfinder } from "../core/Pathfinder";
import { NPC_MATERIAL, NPC_MATERIAL_SEEKING, NPC_MATERIAL_AGGRO } from "../structures/BlockTypes";

// Extended seek behavior to track target entity
interface SeekTarget {
  entityId: number;
  playerId: string;
}

/**
 * SeekSystem - Handles NPC pursuit of players.
 *
 * Multiplayer Support:
 * - NPCs only target players who are NOT their owner
 * - In single-player, targets the local player (PLAYER_ENTITY)
 * - In multiplayer, finds nearest enemy player
 *
 * Flow:
 * 1. IDLE: Check if any enemy player is within detection radius
 *    - If yes: transition to SEEKING, set target to that player
 * 2. SEEKING: Chase player for N steps (cells traveled)
 *    - Update target to player's current position
 *    - Count each cell/waypoint reached
 *    - When steps exhausted: increment aggravation, transition to COOLDOWN
 * 3. COOLDOWN: Wait before can seek again
 *    - Decrement cooldown timer
 *    - When done: transition to IDLE
 * 4. SEEK-AND-DESTROY: Triggered after aggravation threshold (3x)
 *    - Chase player's DESTINATION (where they clicked) for 10 seconds
 *    - NPC turns blue
 *    - After duration: reset aggravation, transition to COOLDOWN
 *
 * Runs BEFORE NPCMovementSystem so seeking takes priority over wandering.
 */
export function createSeekSystem(): (world: World, dt: number) => void {
  // Track last known pathIndex per entity to detect waypoint progress
  const lastPathIndex = new Map<number, number>();
  // Skip step counting after path recalculation
  const skipStepCount = new Set<number>();
  // Track which player each NPC is targeting
  const seekTargets = new Map<number, SeekTarget>();

  /**
   * Find the nearest enemy player for an NPC.
   * Returns null if no enemy is in range or if in single-player with "local" owner.
   */
  function findNearestEnemy(
    world: World,
    npcPos: Position,
    npcOwnerId: string,
    detectionRadius: number
  ): { target: SeekTarget; position: Position; distance: number } | null {
    const npcCell = Pathfinder.worldToCell(npcPos.x, npcPos.z);
    let nearest: { target: SeekTarget; position: Position; distance: number } | null = null;

    // First, try to find players with PlayerIdentity (multiplayer)
    const playersWithIdentity = world.query(PLAYER_IDENTITY, POSITION);

    if (playersWithIdentity.length > 0) {
      // Multiplayer mode - check all players
      for (const playerEntityId of playersWithIdentity) {
        const identity = world.getComponent<PlayerIdentity>(playerEntityId, PLAYER_IDENTITY);
        const playerPos = world.getComponent<Position>(playerEntityId, POSITION);
        if (!identity || !playerPos) continue;

        // Skip if this is the NPC's owner (friendly)
        if (identity.playerId === npcOwnerId) continue;

        const playerCell = Pathfinder.worldToCell(playerPos.x, playerPos.z);
        const dx = playerCell.x - npcCell.x;
        const dz = playerCell.z - npcCell.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= detectionRadius) {
          if (!nearest || dist < nearest.distance) {
            nearest = {
              target: { entityId: playerEntityId, playerId: identity.playerId },
              position: playerPos,
              distance: dist,
            };
          }
        }
      }
    } else {
      // Single-player mode - use PLAYER_ENTITY
      // In single-player, ownerId is "local" and we always target the player
      const playerPos = world.getComponent<Position>(PLAYER_ENTITY, POSITION);
      if (playerPos) {
        const playerCell = Pathfinder.worldToCell(playerPos.x, playerPos.z);
        const dx = playerCell.x - npcCell.x;
        const dz = playerCell.z - npcCell.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= detectionRadius) {
          nearest = {
            target: { entityId: PLAYER_ENTITY, playerId: "player" },
            position: playerPos,
            distance: dist,
          };
        }
      }
    }

    return nearest;
  }

  /**
   * Get a target player's position and PathFollower.
   */
  function getTargetInfo(
    world: World,
    target: SeekTarget
  ): { position: Position; pathFollower: PathFollower | undefined } | null {
    const position = world.getComponent<Position>(target.entityId, POSITION);
    if (!position) return null;

    const pathFollower = world.getComponent<PathFollower>(target.entityId, PATH_FOLLOWER);
    return { position, pathFollower };
  }

  return (world: World, dt: number) => {
    // Query NPCs with seek behavior
    const seekers = world.query(SEEK_BEHAVIOR, PATH_FOLLOWER, POSITION, NPC_DATA);

    for (const entityId of seekers) {
      const seek = world.getComponent<SeekBehavior>(entityId, SEEK_BEHAVIOR);
      const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(entityId, POSITION);
      const npcData = world.getComponent<NPCData>(entityId, NPC_DATA);
      if (!seek || !pf || !pos || !npcData) continue;

      const npcCell = Pathfinder.worldToCell(pos.x, pos.z);

      switch (seek.state) {
        case "idle": {
          // Find nearest enemy player
          const enemy = findNearestEnemy(world, pos, npcData.ownerId, seek.detectionRadius);

          if (enemy) {
            // Start seeking!
            seek.state = "seeking";
            seek.stepsRemaining = seek.pursuitSteps;
            const targetCell = Pathfinder.worldToCell(enemy.position.x, enemy.position.z);
            seek.lastPlayerCellX = targetCell.x;
            seek.lastPlayerCellZ = targetCell.z;

            // Track the target
            seekTargets.set(entityId, enemy.target);

            // Turn NPC red when seeking
            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL_SEEKING;
            }

            // Initialize pathIndex tracking
            lastPathIndex.set(entityId, -1);

            // Disable wandering while seeking
            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 999;
            }

            // Set path target to enemy
            const targetWorld = Pathfinder.cellToWorld(targetCell.x, targetCell.z);
            pf.targetX = targetWorld.x;
            pf.targetZ = targetWorld.z;
            pf.needsPath = true;
            pf.path = [];
            pf.pathIndex = -1;
            skipStepCount.add(entityId);
          }
          break;
        }

        case "seeking": {
          const target = seekTargets.get(entityId);
          const targetInfo = target ? getTargetInfo(world, target) : null;

          // If target is gone, go back to idle
          if (!targetInfo) {
            seek.state = "idle";
            seekTargets.delete(entityId);

            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL;
            }

            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;

            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 0.5;
            }
            break;
          }

          const targetCell = Pathfinder.worldToCell(targetInfo.position.x, targetInfo.position.z);

          // Track waypoint progress to count steps
          const prevIndex = lastPathIndex.get(entityId) ?? -1;
          const currentIndex = pf.pathIndex;

          if (skipStepCount.has(entityId)) {
            if (currentIndex >= 2) {
              skipStepCount.delete(entityId);
            }
            lastPathIndex.set(entityId, currentIndex);
          } else {
            if (currentIndex === prevIndex + 1 && currentIndex >= 2) {
              seek.stepsRemaining--;
            }
            lastPathIndex.set(entityId, currentIndex);
          }

          // Check if pursuit steps exhausted
          if (seek.stepsRemaining <= 0) {
            seek.aggravationCount++;
            lastPathIndex.delete(entityId);

            if (seek.aggravationCount >= seek.aggravationThreshold) {
              // Enter SEEK-AND-DESTROY mode!
              seek.state = "seek-and-destroy";
              seek.seekAndDestroyRemaining = seek.seekAndDestroyDuration;

              const mesh = world.getObject3D(entityId);
              if (mesh && mesh instanceof THREE.Mesh) {
                mesh.material = NPC_MATERIAL_AGGRO;
              }

              // Target player's destination
              if (targetInfo.pathFollower) {
                pf.targetX = targetInfo.pathFollower.targetX;
                pf.targetZ = targetInfo.pathFollower.targetZ;
              } else {
                const tw = Pathfinder.cellToWorld(targetCell.x, targetCell.z);
                pf.targetX = tw.x;
                pf.targetZ = tw.z;
              }
              pf.needsPath = true;
              pf.path = [];
              pf.pathIndex = -1;
            } else {
              // Enter normal cooldown
              seek.state = "cooldown";
              seek.cooldownRemaining = seek.cooldownTime;

              const mesh = world.getObject3D(entityId);
              if (mesh && mesh instanceof THREE.Mesh) {
                mesh.material = NPC_MATERIAL;
              }

              pf.path = [];
              pf.pathIndex = -1;
              pf.needsPath = false;

              const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
              if (wander) {
                wander.waitTime = 0.5;
              }
            }
            break;
          }

          // Update target to player's current position if they moved
          if (targetCell.x !== seek.lastPlayerCellX || targetCell.z !== seek.lastPlayerCellZ) {
            seek.lastPlayerCellX = targetCell.x;
            seek.lastPlayerCellZ = targetCell.z;

            const tw = Pathfinder.cellToWorld(targetCell.x, targetCell.z);
            pf.targetX = tw.x;
            pf.targetZ = tw.z;
            pf.needsPath = true;
            skipStepCount.add(entityId);
          }

          // Request path if needed
          if (pf.pathIndex === -1 && pf.path.length === 0 && !pf.needsPath) {
            const tw = Pathfinder.cellToWorld(targetCell.x, targetCell.z);
            pf.targetX = tw.x;
            pf.targetZ = tw.z;
            pf.needsPath = true;
          }
          break;
        }

        case "cooldown":
          seek.cooldownRemaining -= dt;

          if (seek.cooldownRemaining <= 0) {
            seek.state = "idle";
            seek.cooldownRemaining = 0;
            seekTargets.delete(entityId);
          }
          break;

        case "seek-and-destroy": {
          seek.seekAndDestroyRemaining -= dt;

          const target = seekTargets.get(entityId);
          const targetInfo = target ? getTargetInfo(world, target) : null;

          // If target is gone, exit seek-and-destroy
          if (!targetInfo) {
            seek.state = "cooldown";
            seek.cooldownRemaining = seek.cooldownTime;
            seek.aggravationCount = 0;
            seekTargets.delete(entityId);

            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL;
            }

            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;

            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 0.5;
            }
            break;
          }

          const targetCell = Pathfinder.worldToCell(targetInfo.position.x, targetInfo.position.z);
          const dx = targetCell.x - npcCell.x;
          const dz = targetCell.z - npcCell.z;
          const distToTarget = Math.sqrt(dx * dx + dz * dz);

          // Check if player escaped
          if (distToTarget > seek.detectionRadius * 4) {
            seek.state = "cooldown";
            seek.cooldownRemaining = seek.cooldownTime;
            seek.aggravationCount = 0;
            seekTargets.delete(entityId);

            const escapeMesh = world.getObject3D(entityId);
            if (escapeMesh && escapeMesh instanceof THREE.Mesh) {
              escapeMesh.material = NPC_MATERIAL;
            }

            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;

            const escapeWander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (escapeWander) {
              escapeWander.waitTime = 0.5;
            }
            break;
          }

          // Chase player's destination
          if (targetInfo.pathFollower) {
            const destX = targetInfo.pathFollower.targetX;
            const destZ = targetInfo.pathFollower.targetZ;

            if (pf.targetX !== destX || pf.targetZ !== destZ) {
              pf.targetX = destX;
              pf.targetZ = destZ;
              pf.needsPath = true;
            }
          }

          // Request path if needed
          if (pf.pathIndex === -1 && pf.path.length === 0 && !pf.needsPath) {
            pf.needsPath = true;
          }

          // Check if duration expired
          if (seek.seekAndDestroyRemaining <= 0) {
            seek.state = "cooldown";
            seek.cooldownRemaining = seek.cooldownTime;
            seek.aggravationCount = 0;
            seekTargets.delete(entityId);

            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL;
            }

            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;

            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 0.5;
            }
          }
          break;
        }
      }
    }
  };
}
