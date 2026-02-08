import { GameServer } from "./GameServer";

const PORT = parseInt(process.env.PORT || "1340", 10);

console.log("Starting multiplayer game server...");
const server = new GameServer(PORT);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down server...");
  server.shutdown();
  process.exit(0);
});
