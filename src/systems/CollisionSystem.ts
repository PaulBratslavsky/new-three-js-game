import { World } from "../ecs/World";
import {
  COLLIDER,
  COLLISION_STATE,
  POSITION,
  type Collider,
  type CollisionContact,
  type CollisionState,
  type Position,
} from "../ecs/components";
import { SpatialHash } from "../core/SpatialHash";

interface CollidableEntity {
  id: number;
  pos: Position;
  col: Collider;
  state: CollisionState;
}

// Box vs Box (AABB) collision detection on XZ plane
function boxVsBox(
  posA: Position,
  colA: Collider,
  posB: Position,
  colB: Collider,
  entityBId: number
): CollisionContact | null {
  const ax = posA.x + colA.offsetX;
  const az = posA.z + colA.offsetZ;
  const bx = posB.x + colB.offsetX;
  const bz = posB.z + colB.offsetZ;

  const overlapX = colA.width / 2 + colB.width / 2 - Math.abs(ax - bx);
  const overlapZ = colA.depth / 2 + colB.depth / 2 - Math.abs(az - bz);

  if (overlapX > 0 && overlapZ > 0) {
    // Collision! Return contact with smallest penetration axis
    if (overlapX < overlapZ) {
      return {
        entityId: entityBId,
        layer: colB.layer,
        normalX: ax < bx ? -1 : 1,
        normalZ: 0,
        penetration: overlapX,
      };
    } else {
      return {
        entityId: entityBId,
        layer: colB.layer,
        normalX: 0,
        normalZ: az < bz ? -1 : 1,
        penetration: overlapZ,
      };
    }
  }
  return null;
}

// Circle vs Circle collision detection on XZ plane
function circleVsCircle(
  posA: Position,
  colA: Collider,
  posB: Position,
  colB: Collider,
  entityBId: number
): CollisionContact | null {
  const dx = posB.x + colB.offsetX - (posA.x + colA.offsetX);
  const dz = posB.z + colB.offsetZ - (posA.z + colA.offsetZ);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = colA.radius + colB.radius;

  if (dist < minDist && dist > 0) {
    return {
      entityId: entityBId,
      layer: colB.layer,
      normalX: dx / dist,
      normalZ: dz / dist,
      penetration: minDist - dist,
    };
  }
  return null;
}

// Box vs Circle collision detection on XZ plane
function boxVsCircle(
  posBox: Position,
  colBox: Collider,
  posCircle: Position,
  colCircle: Collider,
  circleEntityId: number
): CollisionContact | null {
  // Find closest point on box to circle center
  const cx = posCircle.x + colCircle.offsetX;
  const cz = posCircle.z + colCircle.offsetZ;
  const bx = posBox.x + colBox.offsetX;
  const bz = posBox.z + colBox.offsetZ;

  const halfWidth = colBox.width / 2;
  const halfDepth = colBox.depth / 2;

  const closestX = Math.max(bx - halfWidth, Math.min(cx, bx + halfWidth));
  const closestZ = Math.max(bz - halfDepth, Math.min(cz, bz + halfDepth));

  const dx = cx - closestX;
  const dz = cz - closestZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < colCircle.radius) {
    return {
      entityId: circleEntityId,
      layer: colCircle.layer,
      normalX: dist > 0 ? dx / dist : 1,
      normalZ: dist > 0 ? dz / dist : 0,
      penetration: colCircle.radius - dist,
    };
  }
  return null;
}

// Dispatch to correct collision detection based on collider types
function detectCollision(
  a: CollidableEntity,
  b: CollidableEntity
): { contactA: CollisionContact | null; contactB: CollisionContact | null } {
  let contactA: CollisionContact | null = null;
  let contactB: CollisionContact | null = null;

  if (a.col.type === "box" && b.col.type === "box") {
    contactA = boxVsBox(a.pos, a.col, b.pos, b.col, b.id);
    if (contactA) {
      contactB = {
        entityId: a.id,
        layer: a.col.layer,
        normalX: -contactA.normalX,
        normalZ: -contactA.normalZ,
        penetration: contactA.penetration,
      };
    }
  } else if (a.col.type === "circle" && b.col.type === "circle") {
    contactA = circleVsCircle(a.pos, a.col, b.pos, b.col, b.id);
    if (contactA) {
      contactB = {
        entityId: a.id,
        layer: a.col.layer,
        normalX: -contactA.normalX,
        normalZ: -contactA.normalZ,
        penetration: contactA.penetration,
      };
    }
  } else if (a.col.type === "box" && b.col.type === "circle") {
    // Box A vs Circle B - contact is from circle's perspective
    const circleContact = boxVsCircle(a.pos, a.col, b.pos, b.col, b.id);
    if (circleContact) {
      // For circle, normal points away from box
      contactB = circleContact;
      // For box, normal points toward circle
      contactA = {
        entityId: b.id,
        layer: b.col.layer,
        normalX: -circleContact.normalX,
        normalZ: -circleContact.normalZ,
        penetration: circleContact.penetration,
      };
    }
  } else if (a.col.type === "circle" && b.col.type === "box") {
    // Circle A vs Box B
    const circleContact = boxVsCircle(b.pos, b.col, a.pos, a.col, a.id);
    if (circleContact) {
      // For circle A, normal points away from box
      contactA = {
        entityId: b.id,
        layer: b.col.layer,
        normalX: circleContact.normalX,
        normalZ: circleContact.normalZ,
        penetration: circleContact.penetration,
      };
      // For box B, normal points toward circle
      contactB = {
        entityId: a.id,
        layer: a.col.layer,
        normalX: -circleContact.normalX,
        normalZ: -circleContact.normalZ,
        penetration: circleContact.penetration,
      };
    }
  }

  return { contactA, contactB };
}

export function createCollisionSystem(): (world: World, dt: number) => void {
  // Spatial hash with cell size of 2 units (covers most collision radii)
  const spatialHash = new SpatialHash<CollidableEntity>(2);
  // Track which pairs we've already checked this frame
  const checkedPairs = new Set<string>();

  return (world: World, _dt: number) => {
    // Clear spatial hash and checked pairs for new frame
    spatialHash.clear();
    checkedPairs.clear();

    // Query all entities with COLLIDER + POSITION
    const collidables = world.query(COLLIDER, POSITION);

    // Build array of entity data and insert into spatial hash
    const entities: CollidableEntity[] = [];

    for (const entityId of collidables) {
      const pos = world.getComponent<Position>(entityId, POSITION);
      const col = world.getComponent<Collider>(entityId, COLLIDER);
      let state = world.getComponent<CollisionState>(entityId, COLLISION_STATE);

      if (!pos || !col) continue;

      // Create CollisionState if missing
      if (!state) {
        state = { contacts: [], isColliding: false };
        world.addComponent<CollisionState>(entityId, COLLISION_STATE, state);
      }

      // Clear previous frame's contacts
      state.contacts = [];
      state.isColliding = false;

      const entity: CollidableEntity = { id: entityId, pos, col, state };
      entities.push(entity);

      // Insert into spatial hash
      spatialHash.insert(pos.x, pos.z, entity);
    }

    // For each entity, check only nearby entities from spatial hash
    for (const a of entities) {
      const nearby = spatialHash.queryNearby(a.pos.x, a.pos.z);

      for (const b of nearby) {
        // Skip self
        if (a.id === b.id) continue;

        // Skip if already checked this pair (use ordered key)
        const pairKey = a.id < b.id ? `${a.id},${b.id}` : `${b.id},${a.id}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Check layer compatibility
        const aCollidesWithB = a.col.collidesWith.has(b.col.layer);
        const bCollidesWithA = b.col.collidesWith.has(a.col.layer);

        if (!aCollidesWithB && !bCollidesWithA) continue;

        // Detect collision
        const { contactA, contactB } = detectCollision(a, b);

        // Add contacts to both entities
        if (contactA && aCollidesWithB) {
          a.state.contacts.push(contactA);
          a.state.isColliding = true;
        }
        if (contactB && bCollidesWithA) {
          b.state.contacts.push(contactB);
          b.state.isColliding = true;
        }
      }
    }
  };
}
