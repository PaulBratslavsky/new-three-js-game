import type * as THREE from "three";
import type { EntityId } from "./components";

export class World {
  private nextId = 0;
  private readonly alive = new Set<EntityId>();

  // Component stores: componentName → (entityId → data)
  private readonly stores = new Map<string, Map<EntityId, unknown>>();

  // Side table for Three.js Object3D references
  private readonly object3Ds = new Map<EntityId, THREE.Object3D>();

  // --- Entity lifecycle ---

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.alive.has(id)) return;
    this.alive.delete(id);

    // Remove from all component stores
    for (const store of this.stores.values()) {
      store.delete(id);
    }

    // Remove from side table
    this.object3Ds.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  // --- Component operations ---

  addComponent<T>(id: EntityId, name: string, data: T): void {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map<EntityId, unknown>();
      this.stores.set(name, store);
    }
    store.set(id, data);
  }

  getComponent<T>(id: EntityId, name: string): T {
    const store = this.stores.get(name);
    return store?.get(id) as T;
  }

  hasComponent(id: EntityId, name: string): boolean {
    const store = this.stores.get(name);
    return store?.has(id) ?? false;
  }

  removeComponent(id: EntityId, name: string): void {
    const store = this.stores.get(name);
    store?.delete(id);
  }

  // --- Queries ---

  query(...componentNames: string[]): EntityId[] {
    const results: EntityId[] = [];
    for (const id of this.alive) {
      let hasAll = true;
      for (const name of componentNames) {
        if (!this.hasComponent(id, name)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) results.push(id);
    }
    return results;
  }

  // --- Object3D side table ---

  setObject3D(id: EntityId, obj: THREE.Object3D): void {
    this.object3Ds.set(id, obj);
  }

  getObject3D(id: EntityId): THREE.Object3D | undefined {
    return this.object3Ds.get(id);
  }

  removeObject3D(id: EntityId): void {
    this.object3Ds.delete(id);
  }
}
