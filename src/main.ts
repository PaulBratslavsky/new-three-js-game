import "./style.css";
import * as THREE from "three";
import { InputManager } from "./core/InputManager";
import { CameraController } from "./systems/CameraController";
import { ChunkManager } from "./grid/ChunkManager";
import { SelectionSystem } from "./systems/SelectionSystem";
import { PlacementSystem } from "./structures/PlacementSystem";
import { CoordinateDisplay } from "./ui/CoordinateDisplay";
import { BlockSelector } from "./ui/BlockSelector";
import { emitEvent } from "./core/EventBus";

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

// --- SYSTEMS ---
const input = new InputManager();
const cameraController = new CameraController(camera, input);
new ChunkManager(scene, 2); // NOSONAR - self-initializing UI component   
const placementSystem = new PlacementSystem(scene);const selectionSystem = new SelectionSystem(camera, scene);

// --- UI ---
new CoordinateDisplay(); // NOSONAR - self-initializing UI component                                 
new BlockSelector(); // NOSONAR - self-initializing UI component              

// --- GAME LOOP ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  cameraController.update(deltaTime);
  selectionSystem.update();
  placementSystem.update(); 

  renderer.render(scene, camera);
}

// --- RESIZE HANDLER ---
globalThis.addEventListener("resize", () => {
  const width = globalThis.innerWidth;
  const height = globalThis.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  // Emit event so other systems can respond
  emitEvent("window:resized", { width, height });
});

// --- START ---
animate();
