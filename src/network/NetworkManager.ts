import { io, Socket } from "socket.io-client";
import * as THREE from "three";
import { World } from "../ecs/World";
import {
  POSITION,
  PATH_FOLLOWER,
  PLAYER_ENTITY,
  GAME_STATE_ENTITY,
  INPUT_STATE,
  PLAYER_IDENTITY,
  type Position,
  type PathFollower,
  type InputState,
  type PlayerIdentity,
} from "../ecs/components";
import { emitEvent } from "../core/EventBus";

// Types matching server
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface PlayerState {
  id: string;
  color: number;
  position: Vec3;
  rotation: number;
}

interface BlockData {
  x: number;
  y: number;
  z: number;
  type: string;
  ownerId: string;
}

interface SpawnerData {
  id: string;
  x: number;
  y: number;
  z: number;
  ownerId: string;
  radius: number;
  maxNPCs: number;
}

interface NPCState {
  id: string;
  spawnerId: string;
  ownerId: string;
  position: Vec3;
  state: string;
}

interface WelcomeData {
  playerId: string;
  color: number;
  position: Vec3;
  players: PlayerState[];
  blocks: BlockData[];
  spawners: SpawnerData[];
  npcs: NPCState[];
}

export class NetworkManager {
  private socket: Socket | null = null;
  private world: World;
  private scene: THREE.Scene;
  private localPlayerId: string | null = null;
  private localPlayerColor: number = 0x00ff00;
  private inputInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  // Track remote players
  private remotePlayers: Map<string, { entityId: number; mesh: THREE.Mesh }> = new Map();

  // Interpolation state for remote players
  private remotePlayerTargets: Map<string, { position: Vec3; rotation: number; timestamp: number }> = new Map();

  constructor(world: World, scene: THREE.Scene) {
    this.world = world;
    this.scene = scene;
  }

  connect(serverUrl: string = "http://localhost:1340"): void {
    if (this.socket) {
      console.warn("Already connected or connecting");
      return;
    }

    console.log(`Connecting to server: ${serverUrl}`);
    this.socket = io(serverUrl);

    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.connected = true;
      this.socket!.emit("player:join", { name: "Player" });
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.connected = false;
      this.localPlayerId = null;

      // Clean up remote players
      for (const [, data] of this.remotePlayers) {
        this.scene.remove(data.mesh);
        this.world.destroyEntity(data.entityId);
      }
      this.remotePlayers.clear();
      this.remotePlayerTargets.clear();
    });

    this.socket.on("welcome", (data: WelcomeData) => this.handleWelcome(data));
    this.socket.on("player:joined", (data: PlayerState) => this.handlePlayerJoined(data));
    this.socket.on("player:left", (data: { playerId: string }) => this.handlePlayerLeft(data));
    this.socket.on("players:state", (data: { players: PlayerState[]; timestamp: number }) =>
      this.handlePlayersState(data)
    );
    this.socket.on("block:placed", (data: BlockData) => this.handleBlockPlaced(data));
    this.socket.on("block:removed", (data: { x: number; y: number; z: number }) =>
      this.handleBlockRemoved(data)
    );
    this.socket.on("npc:spawned", (data: { npcId: string; spawnerId: string; ownerId: string; position: Vec3 }) =>
      this.handleNPCSpawned(data)
    );
    this.socket.on("npc:destroyed", (data: { npcId: string }) => this.handleNPCDestroyed(data));

    // Start sending inputs at 20 Hz
    this.inputInterval = setInterval(() => this.sendInputs(), 50);
  }

  disconnect(): void {
    if (this.inputInterval) {
      clearInterval(this.inputInterval);
      this.inputInterval = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  getLocalPlayerColor(): number {
    return this.localPlayerColor;
  }

  isLocalPlayer(playerId: string): boolean {
    return playerId === this.localPlayerId;
  }

  // Send block placement to server
  sendBlockPlaced(x: number, y: number, z: number, type: string): void {
    if (!this.socket || !this.localPlayerId) return;

    this.socket.emit("block:placed", {
      x,
      y,
      z,
      type,
      ownerId: this.localPlayerId,
    });
  }

  // Send block removal to server
  sendBlockRemoved(x: number, y: number, z: number): void {
    if (!this.socket) return;

    this.socket.emit("block:removed", { x, y, z });
  }

  // Send NPC spawn to server
  sendNPCSpawned(npcId: string, spawnerId: string, position: Vec3): void {
    if (!this.socket || !this.localPlayerId) return;

    this.socket.emit("npc:spawned", {
      npcId,
      spawnerId,
      ownerId: this.localPlayerId,
      position,
    });
  }

  // Send NPC destruction to server
  sendNPCDestroyed(npcId: string): void {
    if (!this.socket) return;

    this.socket.emit("npc:destroyed", { npcId });
  }

  // Update remote player interpolation (call from game loop)
  updateInterpolation(dt: number): void {
    const lerpFactor = Math.min(dt * 10, 1); // Smooth interpolation

    for (const [playerId, target] of this.remotePlayerTargets) {
      const playerData = this.remotePlayers.get(playerId);
      if (!playerData) continue;

      const pos = this.world.getComponent<Position>(playerData.entityId, POSITION);
      if (pos) {
        pos.x += (target.position.x - pos.x) * lerpFactor;
        pos.z += (target.position.z - pos.z) * lerpFactor;

        playerData.mesh.position.x = pos.x;
        playerData.mesh.position.z = pos.z;
        playerData.mesh.rotation.y = target.rotation;
      }
    }
  }

  private sendInputs(): void {
    if (!this.socket || !this.localPlayerId) return;

    const input = this.world.getComponent<InputState>(GAME_STATE_ENTITY, INPUT_STATE);
    const playerPf = this.world.getComponent<PathFollower>(PLAYER_ENTITY, PATH_FOLLOWER);

    this.socket.emit("player:input", {
      keys: Array.from(input?.keysPressed || []),
      targetX: playerPf?.targetX,
      targetZ: playerPf?.targetZ,
    });
  }

  private handleWelcome(data: WelcomeData): void {
    console.log(`Welcome! Player ID: ${data.playerId}, Color: ${data.color.toString(16)}`);

    this.localPlayerId = data.playerId;
    this.localPlayerColor = data.color;

    // Add PlayerIdentity to local player for multiplayer targeting
    this.world.addComponent<PlayerIdentity>(PLAYER_ENTITY, PLAYER_IDENTITY, {
      playerId: data.playerId,
      isLocal: true,
      color: data.color,
      displayName: "You",
    });

    // Set local player's initial position
    const playerPos = this.world.getComponent<Position>(PLAYER_ENTITY, POSITION);
    if (playerPos) {
      playerPos.x = data.position.x;
      playerPos.z = data.position.z;

      const playerMesh = this.world.getObject3D(PLAYER_ENTITY);
      if (playerMesh) {
        playerMesh.position.x = data.position.x;
        playerMesh.position.z = data.position.z;

        // Tint local player with their color
        if (playerMesh instanceof THREE.Mesh) {
          (playerMesh.material as THREE.MeshStandardMaterial).color.setHex(data.color);
        }
      }
    }

    // Create remote players for existing players
    for (const player of data.players) {
      if (player.id !== this.localPlayerId) {
        this.createRemotePlayer(player);
      }
    }

    // Emit event to notify UI/systems of multiplayer connection
    emitEvent("network:connected", {
      playerId: data.playerId,
      color: data.color,
    });

    // Load existing blocks
    for (const block of data.blocks) {
      emitEvent("network:block:placed", block);
    }

    console.log(`Joined game with ${data.players.length} player(s), ${data.blocks.length} block(s)`);
  }

  private handlePlayerJoined(data: PlayerState): void {
    console.log(`Player joined: ${data.id}`);

    if (data.id !== this.localPlayerId) {
      this.createRemotePlayer(data);
    }
  }

  private handlePlayerLeft(data: { playerId: string }): void {
    console.log(`Player left: ${data.playerId}`);

    const playerData = this.remotePlayers.get(data.playerId);
    if (playerData) {
      this.scene.remove(playerData.mesh);
      this.world.destroyEntity(playerData.entityId);
      this.remotePlayers.delete(data.playerId);
      this.remotePlayerTargets.delete(data.playerId);
    }
  }

  private handlePlayersState(data: { players: PlayerState[]; timestamp: number }): void {
    for (const player of data.players) {
      if (player.id === this.localPlayerId) {
        // Could use for reconciliation - for now, trust client
        continue;
      }

      // Update interpolation target for remote players
      this.remotePlayerTargets.set(player.id, {
        position: player.position,
        rotation: player.rotation,
        timestamp: data.timestamp,
      });
    }
  }

  private handleBlockPlaced(data: BlockData): void {
    // Emit event for PlacementSystem to handle
    emitEvent("network:block:placed", data);
  }

  private handleBlockRemoved(data: { x: number; y: number; z: number }): void {
    // Emit event for PlacementSystem to handle
    emitEvent("network:block:removed", data);
  }

  private handleNPCSpawned(data: { npcId: string; spawnerId: string; ownerId: string; position: Vec3 }): void {
    // Emit event for SpawnerSystem to handle
    emitEvent("network:npc:spawned", data);
  }

  private handleNPCDestroyed(data: { npcId: string }): void {
    // Emit event for SpawnerSystem to handle
    emitEvent("network:npc:destroyed", data);
  }

  private createRemotePlayer(player: PlayerState): void {
    if (this.remotePlayers.has(player.id)) {
      return; // Already exists
    }

    // Create entity
    const entity = this.world.createEntity();
    this.world.addComponent<Position>(entity, POSITION, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
    });

    // Add PlayerIdentity for multiplayer targeting
    this.world.addComponent<PlayerIdentity>(entity, PLAYER_IDENTITY, {
      playerId: player.id,
      isLocal: false,
      color: player.color,
      displayName: `Player ${player.id.slice(0, 4)}`,
    });

    // Create mesh with player color
    const geometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: player.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(player.position.x, player.position.y, player.position.z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.world.setObject3D(entity, mesh);

    this.remotePlayers.set(player.id, { entityId: entity, mesh });
    this.remotePlayerTargets.set(player.id, {
      position: player.position,
      rotation: player.rotation,
      timestamp: Date.now(),
    });

    console.log(`Created remote player: ${player.id} with color ${player.color.toString(16)}`);
  }
}
