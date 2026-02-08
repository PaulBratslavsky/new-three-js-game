import { Server, Socket } from "socket.io";
import { createServer } from "http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerState,
  PlayerInputs,
  BlockData,
  SpawnerData,
  NPCState,
  Vec3,
} from "./types";

// Player colors for visual distinction
const PLAYER_COLORS = [
  0x3498db, // Blue
  0xe74c3c, // Red
  0x2ecc71, // Green
  0xf39c12, // Orange
  0x9b59b6, // Purple
  0x1abc9c, // Teal
  0xe91e63, // Pink
  0x00bcd4, // Cyan
];

interface Player {
  id: string;
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  color: number;
  position: Vec3;
  rotation: number;
  inputs: PlayerInputs;
  name: string;
}

export class GameServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private players: Map<string, Player> = new Map();
  private blocks: Map<string, BlockData> = new Map();
  private spawners: Map<string, SpawnerData> = new Map();
  private npcs: Map<string, NPCState> = new Map();
  private colorIndex = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(port: number = 3001) {
    const httpServer = createServer();
    this.io = new Server(httpServer, {
      cors: { origin: "*" },
    });

    this.setupHandlers();
    httpServer.listen(port, () => {
      console.log(`Game server running on port ${port}`);
    });

    // Game loop at 20 Hz (50ms)
    this.tickInterval = setInterval(() => this.tick(), 50);
  }

  private setupHandlers(): void {
    this.io.on("connection", (socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on("player:join", (data) => this.handlePlayerJoin(socket, data));
      socket.on("player:input", (data) => this.handlePlayerInput(socket, data));
      socket.on("block:placed", (data) => this.handleBlockPlaced(socket, data));
      socket.on("block:removed", (data) => this.handleBlockRemoved(socket, data));
      socket.on("npc:spawned", (data) => this.handleNPCSpawned(socket, data));
      socket.on("npc:destroyed", (data) => this.handleNPCDestroyed(socket, data));
      socket.on("npc:state", (data) => this.handleNPCState(socket, data));
      socket.on("disconnect", () => this.handleDisconnect(socket));
    });
  }

  private handlePlayerJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: { name: string }
  ): void {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;

    const spawnPosition = this.getSpawnPosition();

    const player: Player = {
      id: socket.id,
      socket,
      color,
      position: spawnPosition,
      rotation: 0,
      inputs: { keys: [] },
      name: data.name || `Player ${socket.id.slice(0, 4)}`,
    };

    this.players.set(socket.id, player);

    // Send welcome with current world state
    socket.emit("welcome", {
      playerId: socket.id,
      color: player.color,
      position: player.position,
      players: this.getPlayerStates(),
      blocks: Array.from(this.blocks.values()),
      spawners: Array.from(this.spawners.values()),
      npcs: Array.from(this.npcs.values()),
    });

    // Notify others
    socket.broadcast.emit("player:joined", {
      id: socket.id,
      color: player.color,
      position: player.position,
      rotation: 0,
    });

    console.log(`Player joined: ${player.name} (${socket.id}) with color ${color.toString(16)}`);
  }

  private handlePlayerInput(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: PlayerInputs
  ): void {
    const player = this.players.get(socket.id);
    if (player) {
      player.inputs = data;
    }
  }

  private handleBlockPlaced(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: BlockData
  ): void {
    const key = `${data.x},${data.y},${data.z}`;
    this.blocks.set(key, data);

    // If it's a spawner, track it
    if (data.type === "spawner") {
      const spawnerId = `spawner_${key}`;
      this.spawners.set(spawnerId, {
        id: spawnerId,
        x: data.x,
        y: data.y,
        z: data.z,
        ownerId: data.ownerId,
        radius: 5,
        maxNPCs: 3,
      });
    }

    // Broadcast to all other clients
    socket.broadcast.emit("block:placed", data);
    console.log(`Block placed at (${data.x}, ${data.y}, ${data.z}) by ${data.ownerId}`);
  }

  private handleBlockRemoved(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: { x: number; y: number; z: number }
  ): void {
    const key = `${data.x},${data.y},${data.z}`;
    const block = this.blocks.get(key);

    if (block) {
      this.blocks.delete(key);

      // If it was a spawner, remove it and its NPCs
      if (block.type === "spawner") {
        const spawnerId = `spawner_${key}`;
        this.spawners.delete(spawnerId);

        // Remove NPCs from this spawner
        for (const [npcId, npc] of this.npcs) {
          if (npc.spawnerId === spawnerId) {
            this.npcs.delete(npcId);
            this.io.emit("npc:destroyed", { npcId });
          }
        }
      }

      // Broadcast to all other clients
      socket.broadcast.emit("block:removed", data);
      console.log(`Block removed at (${data.x}, ${data.y}, ${data.z})`);
    }
  }

  private handleNPCSpawned(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: { npcId: string; spawnerId: string; ownerId: string; position: Vec3 }
  ): void {
    const npc: NPCState = {
      id: data.npcId,
      spawnerId: data.spawnerId,
      ownerId: data.ownerId,
      position: data.position,
      state: "idle",
    };

    this.npcs.set(data.npcId, npc);

    // Broadcast to all other clients
    socket.broadcast.emit("npc:spawned", data);
    console.log(`NPC ${data.npcId} spawned for ${data.ownerId}`);
  }

  private handleNPCDestroyed(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: { npcId: string }
  ): void {
    this.npcs.delete(data.npcId);
    socket.broadcast.emit("npc:destroyed", data);
  }

  private handleNPCState(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    data: { npcId: string; position: Vec3; state: string }
  ): void {
    const npc = this.npcs.get(data.npcId);
    if (npc) {
      npc.position = data.position;
      npc.state = data.state as NPCState["state"];
    }
  }

  private handleDisconnect(socket: Socket): void {
    const player = this.players.get(socket.id);
    if (player) {
      console.log(`Player disconnected: ${player.name} (${socket.id})`);

      // Remove player's spawners and NPCs
      for (const [spawnerId, spawner] of this.spawners) {
        if (spawner.ownerId === socket.id) {
          this.spawners.delete(spawnerId);

          // Remove NPCs from this spawner
          for (const [npcId, npc] of this.npcs) {
            if (npc.spawnerId === spawnerId) {
              this.npcs.delete(npcId);
              this.io.emit("npc:destroyed", { npcId });
            }
          }

          // Remove the spawner block
          const key = `${spawner.x},${spawner.y},${spawner.z}`;
          this.blocks.delete(key);
          this.io.emit("block:removed", { x: spawner.x, y: spawner.y, z: spawner.z });
        }
      }

      this.players.delete(socket.id);
      this.io.emit("player:left", { playerId: socket.id });
    }
  }

  private tick(): void {
    // Update player positions based on inputs (simple click-to-move)
    for (const player of this.players.values()) {
      if (player.inputs.targetX !== undefined && player.inputs.targetZ !== undefined) {
        const dx = player.inputs.targetX - player.position.x;
        const dz = player.inputs.targetZ - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.1) {
          const speed = 5 * 0.05; // 5 units/sec * tick interval
          const ratio = Math.min(speed / dist, 1);
          player.position.x += dx * ratio;
          player.position.z += dz * ratio;
          player.rotation = Math.atan2(dx, dz);
        }
      }
    }

    // Broadcast all player states
    if (this.players.size > 0) {
      const states = this.getPlayerStates();
      this.io.emit("players:state", { players: states, timestamp: Date.now() });
    }

    // Broadcast NPC states at lower frequency (every 5 ticks = 10 Hz)
    // For now, just pass through - clients own their NPCs
  }

  private getPlayerStates(): PlayerState[] {
    const states: PlayerState[] = [];
    for (const player of this.players.values()) {
      states.push({
        id: player.id,
        color: player.color,
        position: { ...player.position },
        rotation: player.rotation,
      });
    }
    return states;
  }

  private getSpawnPosition(): Vec3 {
    // Spawn players at random positions within 30 block radius
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 30;
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: 0.5,
      z: Math.round(Math.sin(angle) * radius),
    };
  }

  shutdown(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    this.io.close();
  }
}
