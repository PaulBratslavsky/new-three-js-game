// Shared type definitions for multiplayer

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  color: number;
  position: Vec3;
  rotation: number;
}

export interface PlayerInputs {
  keys: string[];
  targetX?: number;
  targetZ?: number;
}

export interface BlockData {
  x: number;
  y: number;
  z: number;
  type: string;
  ownerId: string;
}

export interface SpawnerData {
  id: string;
  x: number;
  y: number;
  z: number;
  ownerId: string;
  radius: number;
  maxNPCs: number;
}

export interface NPCState {
  id: string;
  spawnerId: string;
  ownerId: string;
  position: Vec3;
  state: "idle" | "seeking" | "cooldown" | "seek-and-destroy";
}

// Client → Server messages
export interface ClientToServerEvents {
  "player:join": (data: { name: string }) => void;
  "player:input": (data: PlayerInputs) => void;
  "block:placed": (data: BlockData) => void;
  "block:removed": (data: { x: number; y: number; z: number }) => void;
  "npc:spawned": (data: { npcId: string; spawnerId: string; ownerId: string; position: Vec3 }) => void;
  "npc:destroyed": (data: { npcId: string }) => void;
  "npc:state": (data: { npcId: string; position: Vec3; state: string }) => void;
}

// Server → Client messages
export interface ServerToClientEvents {
  "welcome": (data: {
    playerId: string;
    color: number;
    position: Vec3;
    players: PlayerState[];
    blocks: BlockData[];
    spawners: SpawnerData[];
    npcs: NPCState[];
  }) => void;
  "player:joined": (data: PlayerState) => void;
  "player:left": (data: { playerId: string }) => void;
  "players:state": (data: { players: PlayerState[]; timestamp: number }) => void;
  "block:placed": (data: BlockData) => void;
  "block:removed": (data: { x: number; y: number; z: number }) => void;
  "npc:spawned": (data: { npcId: string; spawnerId: string; ownerId: string; position: Vec3 }) => void;
  "npc:destroyed": (data: { npcId: string }) => void;
  "npcs:state": (data: { npcs: NPCState[]; timestamp: number }) => void;
}
