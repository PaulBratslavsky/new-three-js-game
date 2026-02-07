// Pathfinding component - attach to any entity that needs pathfinding

export const PATH_FOLLOWER = "PathFollower";

export interface PathPoint {
  x: number;
  z: number;
}

export interface PathFollower {
  path: PathPoint[];        // Current path waypoints
  pathIndex: number;        // Current waypoint index (-1 = no path)
  targetX: number;          // Final destination
  targetZ: number;
  moveSpeed: number;        // Units per second
  needsPath: boolean;       // Request new path calculation
  pathRetryTime: number;    // Cooldown before retrying failed path
}
