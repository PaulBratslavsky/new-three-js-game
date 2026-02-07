import "./style.css";
import * as THREE from "three";
import { World } from "./ecs/World";
import {
  POSITION,
  CAMERA_STATE,
  INPUT_STATE,
  MOUSE_STATE,
  GAME_STATE,
  HIGHLIGHT_TAG,
  CAMERA_ENTITY,
  GAME_STATE_ENTITY,
  HIGHLIGHT_ENTITY,
  type Position,
  type CameraState,
  type InputState,
  type MouseState,
  type GameState,
  type HighlightTag,
} from "./ecs/components";
import { ChunkManager } from "./grid/ChunkManager";
import { CoordinateDisplay } from "./ui/CoordinateDisplay";
import { BlockSelector } from "./ui/BlockSelector";
import { DebugToggle } from "./ui/DebugToggle";
import { emitEvent } from "./core/EventBus";

import { createInputSystem } from "./systems/InputSystem";
import { createCameraMovementSystem } from "./systems/CameraMovementSystem";
import { createChunkLoadingSystem } from "./systems/ChunkLoadingSystem";
import { createSelectionSystem } from "./systems/SelectionSystem";
import { createPlacementSystem } from "./systems/PlacementSystem";
import { createNavObstacleSystem } from "./systems/NavObstacleSystem";
import { createSpawnerSystem } from "./systems/SpawnerSystem";
import { createNPCMovementSystem } from "./systems/NPCMovementSystem";
import { createPathfindingSystem } from "./systems/PathfindingSystem";
import { createCollisionSystem } from "./systems/CollisionSystem";
import { createCollisionResponseSystem } from "./systems/CollisionResponseSystem";
import { createRenderSyncSystem } from "./systems/RenderSyncSystem";
import { createUISystem } from "./systems/UISystem";
import { createDebugGridSystem } from "./systems/DebugGridSystem";

// --- SCENE SETUP ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 10, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// --- ECS WORLD ---
const world = new World();

// Entity 0: Camera
const cameraEntity = world.createEntity(); // ID 0
world.addComponent<Position>(cameraEntity, POSITION, { x: 5, y: 10, z: 5 });
world.addComponent<CameraState>(cameraEntity, CAMERA_STATE, {
  angle: 0,
  moveSpeed: 10,
  rotateSpeed: 2,
  snapAngle: Math.PI / 2,
  snapThreshold: 0.05,
  lastEmittedX: 5,
  lastEmittedZ: 5,
});
world.setObject3D(cameraEntity, camera);

// Entity 1: Game State
const gameStateEntity = world.createEntity(); // ID 1
world.addComponent<InputState>(gameStateEntity, INPUT_STATE, {
  keysPressed: new Set<string>(),
});
world.addComponent<MouseState>(gameStateEntity, MOUSE_STATE, {
  ndcX: 0,
  ndcY: 0,
  leftDown: false,
  rightDown: false,
  leftClicked: false,
  rightClicked: false,
});
world.addComponent<GameState>(gameStateEntity, GAME_STATE, {
  selectedBlockType: "stone",
  buildLevel: 0,
  placedBlockKeys: new Map(),
});

// Entity 2: Highlight
const highlightEntity = world.createEntity(); // ID 2
world.addComponent<Position>(highlightEntity, POSITION, { x: 0, y: 0, z: 0 });
world.addComponent<HighlightTag>(highlightEntity, HIGHLIGHT_TAG, {});

const highlightGeometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);
const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff00,
  transparent: true,
  opacity: 0.3,
  depthTest: false,
});
const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
highlightMesh.visible = false;
scene.add(highlightMesh);
world.setObject3D(highlightEntity, highlightMesh);

// Verify well-known entity IDs match expectations
if (cameraEntity !== CAMERA_ENTITY) throw new Error("Camera entity ID mismatch");
if (gameStateEntity !== GAME_STATE_ENTITY) throw new Error("GameState entity ID mismatch");
if (highlightEntity !== HIGHLIGHT_ENTITY) throw new Error("Highlight entity ID mismatch");

// --- INFRASTRUCTURE ---
const chunkManager = new ChunkManager(scene, 2);

// --- SYSTEMS ---
const systems = [
  createInputSystem(),
  createCameraMovementSystem(),
  createChunkLoadingSystem(chunkManager),
  createSelectionSystem(scene),
  createPlacementSystem(scene),
  createNavObstacleSystem(),        // Syncs NavObstacle components with pathfinder
  createSpawnerSystem(scene),
  createNPCMovementSystem(),      // Picks targets, requests paths
  createPathfindingSystem(),       // Calculates and follows paths
  createCollisionSystem(),
  createCollisionResponseSystem(),
  createRenderSyncSystem(),
  createUISystem(),
  createDebugGridSystem(scene),
];

// --- UI ---
new CoordinateDisplay(); // NOSONAR - self-initializing UI component
new BlockSelector(); // NOSONAR - self-initializing UI component
new DebugToggle(); // NOSONAR - debug grid toggle

// --- GAME LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  for (const system of systems) {
    system(world, dt);
  }

  renderer.render(scene, camera);
}

// --- RESIZE HANDLER ---
globalThis.addEventListener("resize", () => {
  const width = globalThis.innerWidth;
  const height = globalThis.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  emitEvent("window:resized", { width, height });
});

// --- START ---
animate();
