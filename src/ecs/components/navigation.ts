// Navigation components

export const NAV_OBSTACLE = "NavObstacle";

/**
 * NavObstacle component - marks an entity as blocking pathfinding.
 * Any entity with Position + NavObstacle will be registered with the pathfinder.
 * This is the ECS way - components define capabilities, not string types.
 */
export interface NavObstacle {
  // Could add properties like:
  // - radius for circular obstacles
  // - dynamic flag for moving obstacles
  // For now, just presence of component marks it as blocking
}
