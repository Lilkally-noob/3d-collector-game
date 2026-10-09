import './style.css';
import * as THREE from 'three';
import { camera, render } from './core.js';
import { training } from './modes/training.js';

// Mode router
const modes = { training };
let current = null; // null = we're on the mode select menu

const modeMenuEl = document.getElementById('modeMenu');

function showMenu() {
  if (current) current.exit();
  current = null;
  modeMenuEl.classList.remove('hidden');
}

function selectMode(name) {
  modeMenuEl.classList.add('hidden');
  current = modes[name];
  current.enter();
}

document.querySelectorAll('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => selectMode(btn.dataset.mode))
);
document.getElementById('backBtn').addEventListener('click', showMenu);

// Camera follow (uses the current mode's focus + offset)
const defaultFocus = new THREE.Vector3(0, 0.5, 0);
const defaultOffset = new THREE.Vector3(0, 10, 12);
const CAMERA_SMOOTHNESS = 5;
const cameraTarget = new THREE.Vector3();

// Game loop
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (current) current.update(delta, currentTime / 1000);

  const focusPos = current ? current.focus.position : defaultFocus;
  const offset = current ? current.cameraOffset : defaultOffset;

  cameraTarget.copy(focusPos).add(offset);
  const t = 1 - Math.exp(-CAMERA_SMOOTHNESS * delta);
  camera.position.lerp(cameraTarget, t);
  camera.lookAt(focusPos);

  render(delta);
}

requestAnimationFrame(animate);