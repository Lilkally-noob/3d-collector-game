import './style.css';
import * as THREE from 'three';
import { scene, camera, render } from './core.js';
import { BOUNDARY } from './arena.js';
import { keys, joy } from './input.js';
import { createPlayer } from './player.js';
import { collectibles, respawnCollectible, animateGems } from './gems.js';

// Player
const player = createPlayer();
scene.add(player);

// Settings
const PLAYER_SPEED = 8;
const COLLECT_DISTANCE = 1.0;
const GAME_DURATION = 30;

// Camera follow
const cameraOffset = new THREE.Vector3(0, 10, 12);
const CAMERA_SMOOTHNESS = 5;
const cameraTarget = new THREE.Vector3();

// HUD elements
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');

// Game state
let state = 'menu'; // 'menu' | 'playing' | 'gameover'
let score = 0;
let timeLeft = GAME_DURATION;

function startGame() {
  score = 0;
  scoreEl.textContent = score;
  timeLeft = GAME_DURATION;
  timerEl.textContent = GAME_DURATION;

  player.position.set(0, 0.5, 0);
  for (const k in keys) keys[k] = false;
  for (const c of collectibles) respawnCollectible(c);

  overlayEl.classList.add('hidden');
  startBtn.blur();
  state = 'playing';
}

function endGame() {
  state = 'gameover';
  overlayTitleEl.textContent = "Time's up!";
  overlayTextEl.textContent = `You collected ${score} gems.`;
  startBtn.textContent = 'Play again';
  overlayEl.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);

// Game loop
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (state === 'playing') {
    let moveX = 0;
    let moveZ = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.hypot(moveX, moveZ);
      moveX /= length;
      moveZ /= length;
    } else {
      moveX = joy.x;
      moveZ = joy.z;
    }

    player.position.x += moveX * PLAYER_SPEED * delta;
    player.position.z += moveZ * PLAYER_SPEED * delta;

    player.position.x = THREE.MathUtils.clamp(player.position.x, -BOUNDARY, BOUNDARY);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -BOUNDARY, BOUNDARY);

    for (const c of collectibles) {
      const dx = player.position.x - c.position.x;
      const dz = player.position.z - c.position.z;
      if (Math.hypot(dx, dz) < COLLECT_DISTANCE) {
        score += 1;
        scoreEl.textContent = score;
        respawnCollectible(c);
      }
    }

    timeLeft -= delta;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
    }
    timerEl.textContent = Math.ceil(timeLeft);
  }

  // Visuals run in every state
  cameraTarget.copy(player.position).add(cameraOffset);
  const t = 1 - Math.exp(-CAMERA_SMOOTHNESS * delta);
  camera.position.lerp(cameraTarget, t);
  camera.lookAt(player.position);

  animateGems(delta, currentTime / 1000);

  render(delta);
}

requestAnimationFrame(animate);