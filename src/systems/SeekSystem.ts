import * as THREE from "three";
import { World } from "../ecs/World";
import {
  SEEK_BEHAVIOR,
  PATH_FOLLOWER,
  POSITION,
  WANDER_BEHAVIOR,
  PLAYER_ENTITY,
  type SeekBehavior,
  type PathFollower,
  type Position,
  type WanderBehavior,
} from "../ecs/components";
import { Pathfinder } from "../core/Pathfinder";
import { NPC_MATERIAL, NPC_MATERIAL_SEEKING, NPC_MATERIAL_AGGRO } from "../structures/BlockTypes";

/**
 * SeekSystem - Handles NPC pursuit of player.
 *
 * Flow:
 * 1. IDLE: Check if player within detection radius
 *    - If yes: transition to SEEKING, set target to player
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

  return (world: World, dt: number) => {
    // Get player position
    const playerPos = world.getComponent<Position>(PLAYER_ENTITY, POSITION);
    if (!playerPos) return;

    const playerCell = Pathfinder.worldToCell(playerPos.x, playerPos.z);

    // Query entities with seek behavior
    const seekers = world.query(SEEK_BEHAVIOR, PATH_FOLLOWER, POSITION);

    for (const entityId of seekers) {
      const seek = world.getComponent<SeekBehavior>(entityId, SEEK_BEHAVIOR);
      const pf = world.getComponent<PathFollower>(entityId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(entityId, POSITION);
      if (!seek || !pf || !pos) continue;

      const npcCell = Pathfinder.worldToCell(pos.x, pos.z);

      // Calculate distance to player (in cells)
      const dx = playerCell.x - npcCell.x;
      const dz = playerCell.z - npcCell.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);

      switch (seek.state) {
        case "idle":
          // Check if player entered detection radius
          if (distToPlayer <= seek.detectionRadius) {
            // Start seeking!
            seek.state = "seeking";
            seek.stepsRemaining = seek.pursuitSteps;
            seek.lastPlayerCellX = playerCell.x;
            seek.lastPlayerCellZ = playerCell.z;

            // Turn NPC red when seeking (swap to shared seeking material)
            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL_SEEKING;
            }

            // Initialize pathIndex tracking
            lastPathIndex.set(entityId, -1);

            // Disable wandering while seeking
            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 999; // Effectively pause wandering
            }

            // Set path target to player
            const targetWorld = Pathfinder.cellToWorld(playerCell.x, playerCell.z);
            pf.targetX = targetWorld.x;
            pf.targetZ = targetWorld.z;
            pf.needsPath = true;
            pf.path = [];
            pf.pathIndex = -1;
            // Skip first step count (path initialization shouldn't count)
            skipStepCount.add(entityId);
          }
          break;

        case "seeking":
          // Track waypoint progress to count steps (cells traveled)
          const prevIndex = lastPathIndex.get(entityId) ?? -1;
          const currentIndex = pf.pathIndex;

          // Skip step counting after path recalculation until we reach waypoint 2+
          // (waypoint 0 is start, waypoint 1 is first step which shouldn't count after recalc)
          if (skipStepCount.has(entityId)) {
            if (currentIndex >= 2) {
              // Path is stable, can start counting again
              skipStepCount.delete(entityId);
            }
            lastPathIndex.set(entityId, currentIndex);
          } else {
            // Only count a step when pathIndex increases by exactly 1 and we're past waypoint 1
            if (currentIndex === prevIndex + 1 && currentIndex >= 2) {
              seek.stepsRemaining--;
            }
            lastPathIndex.set(entityId, currentIndex);
          }

          // Check if pursuit steps exhausted
          if (seek.stepsRemaining <= 0) {
            // Increment aggravation
            seek.aggravationCount++;
            lastPathIndex.delete(entityId);

            // Check if aggravation threshold reached
            if (seek.aggravationCount >= seek.aggravationThreshold) {
              // Enter SEEK-AND-DESTROY mode!
              seek.state = "seek-and-destroy";
              seek.seekAndDestroyRemaining = seek.seekAndDestroyDuration;

              // Turn NPC blue (aggravated)
              const mesh = world.getObject3D(entityId);
              if (mesh && mesh instanceof THREE.Mesh) {
                mesh.material = NPC_MATERIAL_AGGRO;
              }

              // Target player's destination (where they're going)
              const playerPf = world.getComponent<PathFollower>(PLAYER_ENTITY, PATH_FOLLOWER);
              if (playerPf) {
                pf.targetX = playerPf.targetX;
                pf.targetZ = playerPf.targetZ;
              } else {
                // Fallback to current position
                const targetWorld = Pathfinder.cellToWorld(playerCell.x, playerCell.z);
                pf.targetX = targetWorld.x;
                pf.targetZ = targetWorld.z;
              }
              pf.needsPath = true;
              pf.path = [];
              pf.pathIndex = -1;
            } else {
              // Enter normal cooldown
              seek.state = "cooldown";
              seek.cooldownRemaining = seek.cooldownTime;

              // Turn NPC back to green (swap to shared idle material)
              const mesh = world.getObject3D(entityId);
              if (mesh && mesh instanceof THREE.Mesh) {
                mesh.material = NPC_MATERIAL;
              }

              // Clear current path so NPC stops
              pf.path = [];
              pf.pathIndex = -1;
              pf.needsPath = false;

              // Re-enable wandering
              const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
              if (wander) {
                wander.waitTime = 0.5; // Small pause before wandering
              }
            }
            break;
          }

          // Update target to player's current position if they moved
          if (playerCell.x !== seek.lastPlayerCellX || playerCell.z !== seek.lastPlayerCellZ) {
            seek.lastPlayerCellX = playerCell.x;
            seek.lastPlayerCellZ = playerCell.z;

            // Re-target to new player position
            const targetWorld = Pathfinder.cellToWorld(playerCell.x, playerCell.z);
            pf.targetX = targetWorld.x;
            pf.targetZ = targetWorld.z;
            pf.needsPath = true;
            // Skip step counting next frame (path will recalculate, don't count 0→1 as a step)
            skipStepCount.add(entityId);
          }

          // Request path if we have no active path and need to keep chasing
          if (pf.pathIndex === -1 && pf.path.length === 0 && !pf.needsPath) {
            const targetWorld = Pathfinder.cellToWorld(playerCell.x, playerCell.z);
            pf.targetX = targetWorld.x;
            pf.targetZ = targetWorld.z;
            pf.needsPath = true;
          }
          break;

        case "cooldown":
          // Decrement cooldown
          seek.cooldownRemaining -= dt;

          if (seek.cooldownRemaining <= 0) {
            // Cooldown done, back to idle
            seek.state = "idle";
            seek.cooldownRemaining = 0;
            // Aggravation persists - only resets if player stays far away
            // (checked in idle state)
          }
          break;

        case "seek-and-destroy":
          // Time-based pursuit - chase player's destination
          seek.seekAndDestroyRemaining -= dt;

          // Check if player escaped (got far away) - only in seek-and-destroy
          if (distToPlayer > seek.detectionRadius * 4) {
            seek.state = "cooldown";
            seek.cooldownRemaining = seek.cooldownTime;
            seek.aggravationCount = 0;

            // Turn NPC back to green
            const escapeMesh = world.getObject3D(entityId);
            if (escapeMesh && escapeMesh instanceof THREE.Mesh) {
              escapeMesh.material = NPC_MATERIAL;
            }

            // Clear path and re-enable wandering
            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;
            const escapeWander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (escapeWander) {
              escapeWander.waitTime = 0.5;
            }
            break;
          }

          // Get player's destination (where they clicked to move)
          const playerPf = world.getComponent<PathFollower>(PLAYER_ENTITY, PATH_FOLLOWER);
          if (playerPf) {
            const destX = playerPf.targetX;
            const destZ = playerPf.targetZ;

            // Update target if player's destination changed
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
            // Done with seek-and-destroy, enter cooldown
            seek.state = "cooldown";
            seek.cooldownRemaining = seek.cooldownTime;
            seek.aggravationCount = 0; // Reset aggravation after seek-and-destroy

            // Turn NPC back to green
            const mesh = world.getObject3D(entityId);
            if (mesh && mesh instanceof THREE.Mesh) {
              mesh.material = NPC_MATERIAL;
            }

            // Clear path
            pf.path = [];
            pf.pathIndex = -1;
            pf.needsPath = false;

            // Re-enable wandering
            const wander = world.getComponent<WanderBehavior>(entityId, WANDER_BEHAVIOR);
            if (wander) {
              wander.waitTime = 0.5;
            }
          }
          break;
      }
    }
  };
}
