# NPC Spawner System

A complete guide to implementing spawner blocks that create wandering NPCs. This system demonstrates advanced ECS patterns including entity relationships, component-based configuration, and multi-system coordination.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Block Type Registration](#block-type-registration)
5. [SpawnerSystem](#spawnersystem)
6. [NPCMovementSystem](#npcmovementsystem)
7. [Pathfinding Integration](#pathfinding-integration)
8. [PlacementSystem Integration](#placementsystem-integration)
9. [Data Flow](#data-flow)
10. [Implementing in Your Codebase](#implementing-in-your-codebase)
11. [Customization Guide](#customization-guide)

> **Related Documentation:** See [Pathfinding System](./pathfinding-system.md) for details on the A* algorithm, coordinate system, and path following mechanics.

---

## Overview

The NPC Spawner System allows players to place special "spawner" blocks that automatically create NPC entities. These NPCs wander randomly within a configurable radius around their spawner.

**Key Features:**
- Spawner blocks create NPCs at regular intervals
- NPCs wander randomly within a radius of their origin
- NPCs are visualized as 3D triangles pointing in their movement direction
- Removing a spawner automatically despawns all its NPCs
- Fully configurable: radius, max NPCs, spawn interval, movement speed

```mermaid
graph TB
    subgraph "Player Action"
        PLACE[Place Spawner Block]
        REMOVE[Remove Spawner Block]
    end

    subgraph "ECS Entities"
        SPAWNER[Spawner Entity<br/>Position + BlockData + SpawnerData]
        NPC1[NPC Entity 1<br/>Position + NPCData]
        NPC2[NPC Entity 2<br/>Position + NPCData]
        NPC3[NPC Entity 3<br/>Position + NPCData]
    end

    subgraph "Systems"
        SS[SpawnerSystem<br/>Creates NPCs]
        NMS[NPCMovementSystem<br/>Moves NPCs]
        PS[PlacementSystem<br/>Handles block placement/removal]
    end

    PLACE --> PS --> SPAWNER
    SPAWNER --> SS
    SS --> NPC1
    SS --> NPC2
    SS --> NPC3
    NPC1 --> NMS
    NPC2 --> NMS
    NPC3 --> NMS
    REMOVE --> PS
    PS -->|destroys| NPC1
    PS -->|destroys| NPC2
    PS -->|destroys| NPC3
```

---

## Architecture

The spawner system follows ECS principles with clear separation of concerns:

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **Components** | Define data structures for spawners and NPCs | `src/ecs/components.ts` |
| **Block Types** | Register spawner as a placeable block + NPC visuals | `src/structures/BlockTypes.ts` |
| **SpawnerSystem** | Spawn NPCs when conditions are met | `src/systems/SpawnerSystem.ts` |
| **NPCMovementSystem** | Move NPCs toward targets, pick new targets | `src/systems/NPCMovementSystem.ts` |
| **PlacementSystem** | Create spawner components, cleanup on removal | `src/systems/PlacementSystem.ts` |

### Entity Relationships

```mermaid
erDiagram
    SPAWNER ||--o{ NPC : "spawns"
    SPAWNER {
        number entityId
        Position position
        BlockData blockData
        SpawnerData spawnerData
    }
    NPC {
        number entityId
        Position position
        NPCData npcData
    }
```

The spawner tracks its NPCs via `spawnedNPCIds: Set<number>`, and each NPC knows its parent via `spawnerEntityId: number`.

---

## Components

Components are pure data — no methods, no logic. Define them in your components file.

### SpawnerData Component

```typescript
// src/ecs/components.ts

// Component name constant (used for registration and queries)
export const SPAWNER_DATA = "SpawnerData";

// Component data interface
export interface SpawnerData {
  radius: number;              // Wander radius (default: 5)
  maxNPCs: number;             // Maximum NPCs to spawn (default: 3)
  spawnedNPCIds: Set<number>;  // Track spawned NPC entity IDs
  spawnInterval: number;       // Seconds between spawns (default: 2)
  timeSinceLastSpawn: number;  // Accumulator for spawn timing
}
```

**Field Breakdown:**

| Field | Type | Purpose |
|-------|------|---------|
| `radius` | `number` | How far NPCs can wander from the spawner |
| `maxNPCs` | `number` | Spawn limit — stops spawning when reached |
| `spawnedNPCIds` | `Set<number>` | Tracks which NPC entities belong to this spawner |
| `spawnInterval` | `number` | Cooldown between spawns in seconds |
| `timeSinceLastSpawn` | `number` | Timer that accumulates delta time |

### NPCData Component

```typescript
// src/ecs/components/npc.ts

export const NPC_DATA = "NPCData";

export interface NPCData {
  spawnerEntityId: number;  // Parent spawner entity
  originX: number;          // Spawner X position (center of wander area)
  originZ: number;          // Spawner Z position
  radius: number;           // Wander radius (copied from spawner)
  targetX: number;          // Current movement target X
  targetZ: number;          // Current movement target Z
  facingAngle: number;      // Y-axis rotation for mesh
  waitTime: number;         // Pause timer at target (0 = moving)
  prevX: number;            // Previous X position (for collision revert)
  prevZ: number;            // Previous Z position (for collision revert)
}
```

**Field Breakdown:**

| Field | Type | Purpose |
|-------|------|---------|
| `spawnerEntityId` | `number` | Links NPC back to its spawner |
| `originX`, `originZ` | `number` | Center point for wander calculations |
| `radius` | `number` | Maximum distance from origin |
| `targetX`, `targetZ` | `number` | Current destination coordinates |
| `facingAngle` | `number` | Rotation angle (radians) for visual orientation |
| `waitTime` | `number` | Countdown timer for pausing at destinations |
| `prevX`, `prevZ` | `number` | Previous position for collision response |

> **Note:** Movement speed is now defined in the `PathFollower` component, not `NPCData`. See [Pathfinding System](./pathfinding-system.md).

### Adding to ComponentTypeMap

For TypeScript type safety, add your components to the type map:

```typescript
export interface ComponentTypeMap {
  // ... existing components ...
  [SPAWNER_DATA]: SpawnerData;
  [NPC_DATA]: NPCData;
}
```

---

## Block Type Registration

Register the spawner as a placeable block type and define NPC visuals.

### Spawner Block

```typescript
// src/structures/BlockTypes.ts

export const BLOCK_TYPES: BlockType[] = [
  // ... existing blocks (stone, grass, dirt, wood, gold) ...
  {
    id: "spawner",
    name: "Spawner",
    color: 0xff00ff,    // Magenta
    metalness: 0.8,
    roughness: 0.2
  },
];
```

The spawner appears as a shiny magenta cube. Players select it by pressing `6` (the 6th block type).

### NPC Geometry and Material

NPCs use a cone/triangle shape that points in their movement direction:

```typescript
// src/structures/BlockTypes.ts

import * as THREE from "three";

// NPC geometry - a cone with 3 sides creates a triangle shape
export const NPC_GEOMETRY = (() => {
  const geometry = new THREE.ConeGeometry(0.3, 0.8, 3);
  // Rotate so the point faces +Z (forward direction)
  geometry.rotateX(Math.PI / 2);
  return geometry;
})();

// Bright green material for visibility
export const NPC_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x00ff00
});
```

**Why an IIFE for geometry?**

The geometry is created once at module load time. Using an IIFE (Immediately Invoked Function Expression) lets us apply the rotation during creation rather than every time we create an NPC mesh.

```mermaid
graph LR
    subgraph "NPC Visual"
        CONE[ConeGeometry<br/>radius: 0.3<br/>height: 0.8<br/>segments: 3]
        ROTATE[rotateX π/2<br/>Point faces +Z]
        MATERIAL[MeshStandardMaterial<br/>color: green]
        MESH[Final Mesh]
    end
    CONE --> ROTATE --> MESH
    MATERIAL --> MESH
```

---

## SpawnerSystem

The SpawnerSystem runs every frame, checking each spawner to see if it should create a new NPC.

### Full Implementation

```typescript
// src/systems/SpawnerSystem.ts

import * as THREE from "three";
import { World } from "../ecs/World";
import {
  SPAWNER_DATA,
  NPC_DATA,
  POSITION,
  COLLIDER,
  COLLISION_STATE,
  PATH_FOLLOWER,
  type SpawnerData,
  type NPCData,
  type Position,
  type Collider,
  type CollisionState,
  type PathFollower,
} from "../ecs/components";
import { NPC_GEOMETRY, NPC_MATERIAL } from "../structures/BlockTypes";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

/**
 * Find a walkable cell near the spawner.
 */
function findWalkableSpawnCell(
  originX: number,
  originZ: number,
  radius: number
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  for (let r = 1; r <= Math.ceil(radius); r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cellX = originCell.x + dx;
        const cellZ = originCell.z + dz;
        if (!pathfinder.isBlocked(cellX, cellZ)) {
          return { x: cellX, z: cellZ };
        }
      }
    }
  }
  return null;
}

export function createSpawnerSystem(
  scene: THREE.Scene
): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    // Query all entities that have both SPAWNER_DATA and POSITION
    const spawners = world.query(SPAWNER_DATA, POSITION);

    for (const spawnerId of spawners) {
      const spawner = world.getComponent<SpawnerData>(spawnerId, SPAWNER_DATA);
      const pos = world.getComponent<Position>(spawnerId, POSITION);
      if (!spawner || !pos) continue;

      // Clean up dead NPCs from tracking set
      for (const npcId of spawner.spawnedNPCIds) {
        if (!world.isAlive(npcId)) {
          spawner.spawnedNPCIds.delete(npcId);
        }
      }

      // Accumulate spawn timer
      spawner.timeSinceLastSpawn += dt;

      // Check spawn conditions
      if (
        spawner.timeSinceLastSpawn >= spawner.spawnInterval &&
        spawner.spawnedNPCIds.size < spawner.maxNPCs
      ) {
        spawner.timeSinceLastSpawn = 0;

        // Find walkable spawn cell near spawner
        const spawnCell = findWalkableSpawnCell(pos.x, pos.z, spawner.radius);
        if (!spawnCell) {
          continue; // No walkable cell found
        }

        // Convert cell to world position (cell center)
        const spawnWorld = Pathfinder.cellToWorld(spawnCell.x, spawnCell.z);

        // Create NPC entity
        const npcEntity = world.createEntity();

        // Position at cell center
        world.addComponent<Position>(npcEntity, POSITION, {
          x: spawnWorld.x,
          y: pos.y,
          z: spawnWorld.z,
        });

        // NPC behavior data
        world.addComponent<NPCData>(npcEntity, NPC_DATA, {
          spawnerEntityId: spawnerId,
          originX: pos.x,
          originZ: pos.z,
          radius: spawner.radius,
          targetX: spawnWorld.x,
          targetZ: spawnWorld.z,
          facingAngle: 0,
          waitTime: 0.5,  // Wait before first move
          prevX: spawnWorld.x,
          prevZ: spawnWorld.z,
        });

        // PathFollower for grid-based movement
        world.addComponent<PathFollower>(npcEntity, PATH_FOLLOWER, {
          path: [],
          pathIndex: -1,
          targetX: spawnWorld.x,
          targetZ: spawnWorld.z,
          moveSpeed: 3,
          needsPath: false,
          pathRetryTime: 0,
        });

        // Collider for NPC-NPC collision detection
        world.addComponent<Collider>(npcEntity, COLLIDER, {
          type: "circle",
          radius: 0.3,
          layer: "npc",
          collidesWith: new Set(["npc"]),
        });
        world.addComponent<CollisionState>(npcEntity, COLLISION_STATE, {
          contacts: [],
          isColliding: false,
        });

        // Create mesh at cell center
        const mesh = new THREE.Mesh(NPC_GEOMETRY, NPC_MATERIAL);
        mesh.position.set(spawnWorld.x, pos.y + 0.4, spawnWorld.z);
        scene.add(mesh);
        world.setObject3D(npcEntity, mesh);

        // Track NPC in spawner
        spawner.spawnedNPCIds.add(npcEntity);
      }
    }
  };
}
```

### Key Concepts Explained

#### 1. System Factory Pattern

```typescript
export function createSpawnerSystem(scene: THREE.Scene): (world: World, dt: number) => void
```

Systems are created via factory functions that capture dependencies (like `scene`) in a closure. This lets the system access the scene without it being passed every frame.

#### 2. Component Queries

```typescript
const spawners = world.query(SPAWNER_DATA, POSITION);
```

The `query()` method returns all entity IDs that have ALL the specified components. This is how systems find the entities they care about.

#### 3. Dead Entity Cleanup

```typescript
for (const npcId of spawner.spawnedNPCIds) {
  if (!world.isAlive(npcId)) {
    spawner.spawnedNPCIds.delete(npcId);
  }
}
```

NPCs might be destroyed externally. This cleanup ensures the spawner's tracking set stays accurate.

#### 4. Timer Accumulation

```typescript
spawner.timeSinceLastSpawn += dt;
if (spawner.timeSinceLastSpawn >= spawner.spawnInterval) {
  spawner.timeSinceLastSpawn = 0;
  // spawn...
}
```

This is the standard pattern for time-based events in game loops. Accumulate delta time until a threshold is reached.

#### 5. Random Position in Circle

```typescript
const angle = Math.random() * Math.PI * 2;
const distance = Math.random() * spawner.radius;
const targetX = pos.x + Math.cos(angle) * distance;
const targetZ = pos.z + Math.sin(angle) * distance;
```

Generates a random point within a circle using polar coordinates:

```mermaid
graph LR
    subgraph "Random Point in Circle"
        A[Random angle 0-2π] --> C[Convert to X,Z]
        B[Random distance 0-radius] --> C
        C --> D[targetX = origin + cos·distance]
        C --> E[targetZ = origin + sin·distance]
    end
```

---

## NPCMovementSystem

The NPCMovementSystem handles NPC **AI decision-making** — picking targets and requesting paths. Actual movement is handled by the PathfindingSystem.

> **Note:** NPCs now use grid-based pathfinding to navigate around obstacles. See [Pathfinding System](./pathfinding-system.md) for the complete pathfinding documentation.

### Full Implementation

```typescript
// src/systems/NPCMovementSystem.ts

import { World } from "../ecs/World";
import {
  NPC_DATA,
  PATH_FOLLOWER,
  POSITION,
  type NPCData,
  type PathFollower,
  type Position,
} from "../ecs/components";
import { pathfinder, Pathfinder } from "../core/Pathfinder";

const MAX_TARGET_ATTEMPTS = 20;

/**
 * Pick a random walkable cell within radius.
 * Returns cell coordinates (integers).
 */
function pickWalkableTargetCell(
  originX: number,
  originZ: number,
  radius: number
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  for (let attempt = 0; attempt < MAX_TARGET_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const cellX = originCell.x + Math.floor(Math.cos(angle) * dist);
    const cellZ = originCell.z + Math.floor(Math.sin(angle) * dist);

    if (!pathfinder.isBlocked(cellX, cellZ)) {
      return { x: cellX, z: cellZ };
    }
  }
  return null;
}

export function createNPCMovementSystem(): (world: World, dt: number) => void {
  return (world: World, dt: number) => {
    const npcs = world.query(NPC_DATA, PATH_FOLLOWER, POSITION);

    for (const npcId of npcs) {
      const npc = world.getComponent<NPCData>(npcId, NPC_DATA);
      const pf = world.getComponent<PathFollower>(npcId, PATH_FOLLOWER);
      const pos = world.getComponent<Position>(npcId, POSITION);
      if (!npc || !pf || !pos) continue;

      // Store previous position for collision response
      npc.prevX = pos.x;
      npc.prevZ = pos.z;

      // Handle wait time
      if (npc.waitTime > 0) {
        npc.waitTime -= dt;
        continue;
      }

      // Check if NPC needs a new target
      const noPath = pf.pathIndex === -1 && pf.path.length === 0;
      const notRequesting = !pf.needsPath;
      const notWaiting = pf.pathRetryTime <= 0;

      if (noPath && notRequesting && notWaiting) {
        // Pick new random walkable target
        const targetCell = pickWalkableTargetCell(npc.originX, npc.originZ, npc.radius);

        if (targetCell) {
          const targetWorld = Pathfinder.cellToWorld(targetCell.x, targetCell.z);

          npc.targetX = targetWorld.x;
          npc.targetZ = targetWorld.z;

          pf.targetX = targetWorld.x;
          pf.targetZ = targetWorld.z;
          pf.needsPath = true;  // Request path from PathfindingSystem
        } else {
          // No walkable target, wait and try again
          npc.waitTime = 0.5;
        }
      }

      // Update facing based on movement
      if (pf.pathIndex >= 0 && pf.pathIndex < pf.path.length) {
        const waypoint = pf.path[pf.pathIndex];
        const targetWorld = Pathfinder.cellToWorld(waypoint.x, waypoint.z);
        const dx = targetWorld.x - pos.x;
        const dz = targetWorld.z - pos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          npc.facingAngle = Math.atan2(dx, dz);
        }
      }
    }
  };
}
```

### NPC State Machine

The NPC behavior is a state machine coordinated between NPCMovementSystem (AI) and PathfindingSystem (movement):

```mermaid
stateDiagram-v2
    [*] --> Idle: Spawned
    Idle --> PickingTarget: No path & not waiting
    PickingTarget --> RequestingPath: Found walkable target
    PickingTarget --> Waiting: No walkable cell found
    RequestingPath --> Following: Path calculated
    RequestingPath --> Waiting: No path exists
    Following --> Idle: Path complete
    Waiting --> Idle: Wait timer expired

    note right of PickingTarget
        NPCMovementSystem:
        - Pick random walkable cell
        - Set pf.needsPath = true
    end note

    note right of Following
        PathfindingSystem:
        - Move along path waypoints
        - Update mesh position
    end note
```

### Movement Math Explained

```typescript
// Vector from current position to target
const dx = npc.targetX - pos.x;
const dz = npc.targetZ - pos.z;
const distance = Math.sqrt(dx * dx + dz * dz);

// How far we can move this frame
const moveAmount = npc.moveSpeed * dt;

// Ratio ensures we don't overshoot the target
const ratio = Math.min(moveAmount / distance, 1);

// Apply movement
pos.x += dx * ratio;
pos.z += dz * ratio;
```

**Why use a ratio?**

If the NPC is 0.05 units from the target but `moveAmount` is 0.1, moving the full amount would overshoot. The `Math.min(moveAmount / distance, 1)` ensures we never move more than the remaining distance.

### Facing Angle Calculation

```typescript
npc.facingAngle = Math.atan2(dx, dz);
mesh.rotation.y = npc.facingAngle;
```

`atan2(dx, dz)` gives the angle in radians from the +Z axis toward +X. Since our cone geometry points toward +Z after rotation, setting `rotation.y` makes it face the movement direction.

---

## Pathfinding Integration

NPCs use the grid-based pathfinding system to navigate around obstacles. This section covers how the spawner and NPC systems integrate with pathfinding.

### Components Required

Each NPC needs both `NPCData` (AI behavior) and `PathFollower` (pathfinding):

```typescript
// NPCData - AI decision making
world.addComponent<NPCData>(npcEntity, NPC_DATA, {
  spawnerEntityId: spawnerId,
  originX: pos.x,
  originZ: pos.z,
  radius: spawner.radius,
  targetX: spawnWorld.x,
  targetZ: spawnWorld.z,
  facingAngle: 0,
  waitTime: 0.5,
  prevX: spawnWorld.x,   // For collision response
  prevZ: spawnWorld.z,
});

// PathFollower - pathfinding and movement
world.addComponent<PathFollower>(npcEntity, PATH_FOLLOWER, {
  path: [],
  pathIndex: -1,
  targetX: spawnWorld.x,
  targetZ: spawnWorld.z,
  moveSpeed: 3,
  needsPath: false,
  pathRetryTime: 0,
});
```

### System Coordination

```mermaid
sequenceDiagram
    participant NMS as NPCMovementSystem
    participant PFS as PathfindingSystem
    participant PF as Pathfinder

    NMS->>NMS: NPC has no path, pick target
    NMS->>PF: isBlocked(cellX, cellZ)?
    PF-->>NMS: false (walkable)
    NMS->>NMS: Set pf.targetX/Z, needsPath=true

    Note over PFS: Next frame

    PFS->>PF: findPath(current, target)
    PF-->>PFS: PathPoint[] (A* result)
    PFS->>PFS: pf.path = result, pathIndex = 0

    loop Each frame
        PFS->>PFS: Move toward path[pathIndex]
        PFS->>PFS: pathIndex++ at waypoint
    end

    PFS->>PFS: Path complete, pathIndex = -1
    Note over NMS: NPC picks new target
```

### Spawning at Walkable Cells

The SpawnerSystem ensures NPCs spawn on walkable cells:

```typescript
function findWalkableSpawnCell(
  originX: number,
  originZ: number,
  radius: number
): { x: number; z: number } | null {
  const originCell = Pathfinder.worldToCell(originX, originZ);

  // Search outward from origin
  for (let r = 1; r <= Math.ceil(radius); r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

        const cellX = originCell.x + dx;
        const cellZ = originCell.z + dz;

        if (!pathfinder.isBlocked(cellX, cellZ)) {
          return { x: cellX, z: cellZ };
        }
      }
    }
  }
  return null;
}
```

### Collision Response

NPCs track their previous position for collision response:

```typescript
// In NPCMovementSystem - store position before PathfindingSystem moves
npc.prevX = pos.x;
npc.prevZ = pos.z;

// In CollisionResponseSystem - revert on collision
if (state.isColliding) {
  pos.x = npc.prevX;
  pos.z = npc.prevZ;
  pf.path = [];        // Clear invalid path
  pf.pathIndex = -1;
  npc.waitTime = 0.3;  // Wait before picking new target
}
```

---

## PlacementSystem Integration

The existing PlacementSystem needs modifications to handle spawner blocks.

### Creating a Spawner

When a spawner block is placed, add the SpawnerData component:

```typescript
// In placeBlock() function

// Create block entity (existing code)
const blockEntity = world.createEntity();
world.addComponent<Position>(blockEntity, POSITION, { x: newX, y: newY, z: newZ });
world.addComponent<BlockData>(blockEntity, BLOCK_DATA, { blockType: gs.selectedBlockType });
world.setObject3D(blockEntity, mesh);

// NEW: Add spawner component if this is a spawner block
if (gs.selectedBlockType === "spawner") {
  world.addComponent<SpawnerData>(blockEntity, SPAWNER_DATA, {
    radius: 5,
    maxNPCs: 3,
    spawnedNPCIds: new Set(),
    spawnInterval: 2,
    timeSinceLastSpawn: 0,
  });
}

gs.placedBlockKeys.set(key, blockEntity);
```

### Destroying a Spawner

When a spawner is removed, destroy all its NPCs first:

```typescript
// In removeBlock() function

const blockEntity = gs.placedBlockKeys.get(key);
if (blockEntity === undefined) return;

// NEW: If this is a spawner, destroy all its NPCs first
const spawnerData = world.getComponent<SpawnerData>(blockEntity, SPAWNER_DATA);
if (spawnerData) {
  for (const npcId of spawnerData.spawnedNPCIds) {
    const npcMesh = world.getObject3D(npcId);
    if (npcMesh) scene.remove(npcMesh);
    world.destroyEntity(npcId);
  }
  spawnerData.spawnedNPCIds.clear();
}

// Continue with normal block removal...
const mesh = world.getObject3D(blockEntity);
if (mesh) scene.remove(mesh);
world.destroyEntity(blockEntity);
```

### Why Cleanup in PlacementSystem?

The PlacementSystem already handles block removal, so it's the natural place to add spawner cleanup logic. This keeps related logic together and ensures NPCs are cleaned up immediately when their spawner is removed.

---

## Data Flow

Here's how data flows through the system each frame:

```mermaid
sequenceDiagram
    participant GL as Game Loop
    participant PS as PlacementSystem
    participant SS as SpawnerSystem
    participant NMS as NPCMovementSystem
    participant W as World
    participant S as Scene

    GL->>PS: run(world, dt)
    Note over PS: Handle block placement/removal
    PS->>W: Create spawner entity
    PS->>W: Add SpawnerData component

    GL->>SS: run(world, dt)
    SS->>W: Query SPAWNER_DATA + POSITION
    W-->>SS: [spawner entity IDs]

    loop For each spawner
        SS->>W: Get SpawnerData
        SS->>SS: Accumulate timer
        alt Timer >= interval AND count < max
            SS->>W: Create NPC entity
            SS->>W: Add Position + NPCData
            SS->>S: Add NPC mesh
            SS->>W: setObject3D(npcId, mesh)
        end
    end

    GL->>NMS: run(world, dt)
    NMS->>W: Query NPC_DATA + POSITION
    W-->>NMS: [npc entity IDs]

    loop For each NPC
        NMS->>W: Get NPCData, Position
        alt waitTime > 0
            NMS->>NMS: Decrement waitTime
        else At target
            NMS->>NMS: Set waitTime, pick new target
        else Moving
            NMS->>NMS: Move toward target
            NMS->>W: Update mesh transform
        end
    end
```

---

## Implementing in Your Codebase

Follow these steps to add the spawner system to your own ECS-based Three.js project.

### Step 1: Define Components

Add to your components file:

```typescript
// Constants
export const SPAWNER_DATA = "SpawnerData";
export const NPC_DATA = "NPCData";

// Interfaces
export interface SpawnerData {
  radius: number;
  maxNPCs: number;
  spawnedNPCIds: Set<number>;
  spawnInterval: number;
  timeSinceLastSpawn: number;
}

export interface NPCData {
  spawnerEntityId: number;
  originX: number;
  originZ: number;
  radius: number;
  targetX: number;
  targetZ: number;
  moveSpeed: number;
  facingAngle: number;
  waitTime: number;
}
```

### Step 2: Add Block Type and Visuals

```typescript
// Block type
{ id: "spawner", name: "Spawner", color: 0xff00ff, metalness: 0.8, roughness: 0.2 }

// NPC visuals
export const NPC_GEOMETRY = (() => {
  const geometry = new THREE.ConeGeometry(0.3, 0.8, 3);
  geometry.rotateX(Math.PI / 2);
  return geometry;
})();
export const NPC_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
```

### Step 3: Create Systems

Create `SpawnerSystem.ts` and `NPCMovementSystem.ts` (see full implementations above).

### Step 4: Register Systems

Add to your system pipeline:

```typescript
const systems = [
  createInputSystem(),
  createCameraMovementSystem(),
  // ... other systems ...
  createPlacementSystem(scene),
  createSpawnerSystem(scene),      // After PlacementSystem
  createNPCMovementSystem(),       // After SpawnerSystem
  createRenderSyncSystem(),
];
```

**Order matters!** SpawnerSystem must run after PlacementSystem so newly placed spawners have their components. NPCMovementSystem must run after SpawnerSystem so newly spawned NPCs can move on their first frame.

### Step 5: Integrate with Placement

Modify your placement system to:
1. Add SpawnerData when placing spawner blocks
2. Clean up NPCs when removing spawner blocks

---

## Customization Guide

### Adjusting Defaults

Modify these values when creating SpawnerData:

```typescript
world.addComponent<SpawnerData>(blockEntity, SPAWNER_DATA, {
  radius: 10,          // Larger wander area
  maxNPCs: 5,          // More NPCs per spawner
  spawnedNPCIds: new Set(),
  spawnInterval: 1,    // Faster spawning
  timeSinceLastSpawn: 0,
});
```

### Different NPC Speeds

Modify when creating NPCData in SpawnerSystem:

```typescript
world.addComponent<NPCData>(npcEntity, NPC_DATA, {
  // ...
  moveSpeed: 4,  // Faster NPCs
  // ...
});
```

### Custom NPC Appearance

Replace the geometry and material:

```typescript
// Different shape
export const NPC_GEOMETRY = new THREE.SphereGeometry(0.4, 8, 8);

// Different color
export const NPC_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff6600,  // Orange
  emissive: 0x331100,
});
```

### Adding NPC Types

Extend NPCData with a type field:

```typescript
export interface NPCData {
  // ... existing fields ...
  npcType: "wanderer" | "guard" | "merchant";
}
```

Then branch behavior in NPCMovementSystem:

```typescript
if (npc.npcType === "guard") {
  // Stand still, face random direction occasionally
} else if (npc.npcType === "merchant") {
  // Follow a fixed path
} else {
  // Default wander behavior
}
```

### Per-Spawner Configuration

To allow different spawners to have different settings, you could:

1. Add a spawner type to BlockData
2. Look up configuration based on type
3. Or: create a UI to configure spawners after placement

---

## File Map

| File | Purpose |
|------|---------|
| `src/ecs/components.ts` | SPAWNER_DATA, NPC_DATA constants and interfaces |
| `src/structures/BlockTypes.ts` | Spawner block type, NPC_GEOMETRY, NPC_MATERIAL |
| `src/systems/SpawnerSystem.ts` | Spawn NPCs from spawner blocks |
| `src/systems/NPCMovementSystem.ts` | NPC wandering behavior |
| `src/systems/PlacementSystem.ts` | Spawner creation and cleanup integration |
| `src/main.ts` | System registration |

---

## Summary

The NPC Spawner System demonstrates several important ECS patterns:

1. **Entity Relationships**: Spawners track their NPCs, NPCs know their spawner
2. **Component-Based Configuration**: All settings live in component data
3. **Multi-System Coordination**: SpawnerSystem creates, NPCMovementSystem animates, PlacementSystem cleans up
4. **Factory Pattern for Systems**: Capture dependencies like `scene` in closures
5. **Timer Accumulation**: Standard pattern for time-based game events
6. **Cleanup Responsibilities**: Systems that create entities should have cleanup paths

This pattern can be extended to any spawner-type system: enemy spawners, particle emitters, resource generators, etc.
