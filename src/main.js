import './style.css';
import * as THREE from 'three';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 10, 12);
camera.lookAt(0, 0, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Ground
const ARENA_SIZE = 20;

const groundGeometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2d6a4f });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 10, 5);
scene.add(sunLight);

// Player
function createPlayer() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.5;
  return mesh;
}

const player = createPlayer();
scene.add(player);

// Input
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const code in keys) keys[code] = false;
});

// Movement settings
const PLAYER_SPEED = 8;
const BOUNDARY = ARENA_SIZE / 2 - 0.5;

// Camera follow settings
const cameraOffset = new THREE.Vector3(0, 10, 12);
const CAMERA_SMOOTHNESS = 5;
const cameraTarget = new THREE.Vector3();

// Collectibles
const COLLECTIBLE_COUNT = 5;

const collectibleGeometry = new THREE.OctahedronGeometry(0.4);
const collectibleMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd23f,
  emissive: 0xffa800,
  emissiveIntensity: 0.3,
});

function randomArenaPosition() {
  return {
    x: (Math.random() * 2 - 1) * BOUNDARY,
    z: (Math.random() * 2 - 1) * BOUNDARY,
  };
}

function createCollectible() {
  const mesh = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
  const pos = randomArenaPosition();
  mesh.position.set(pos.x, 0.8, pos.z);
  mesh.userData.phase = Math.random() * Math.PI * 2;
  return mesh;
}

const collectibles = [];
for (let i = 0; i < COLLECTIBLE_COUNT; i++) {
  const c = createCollectible();
  scene.add(c);
  collectibles.push(c);
}

// Scoring + collision settings
let score = 0;
const COLLECT_DISTANCE = 1.0;
const scoreEl = document.getElementById('score');

function respawnCollectible(c) {
  const pos = randomArenaPosition();
  c.position.x = pos.x;
  c.position.z = pos.z;
}

// Game state
let state = 'menu'; // 'menu' | 'playing' | 'gameover'
const GAME_DURATION = 30; // seconds
let timeLeft = GAME_DURATION;

const timerEl = document.getElementById('timer');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');

function startGame() {
  score = 0;
  scoreEl.textContent = score;
  timeLeft = GAME_DURATION;
  timerEl.textContent = GAME_DURATION;

  player.position.set(0, 0.5, 0);
  for (const k in keys) keys[k] = false;
  for (const c of collectibles) respawnCollectible(c);

  overlayEl.classList.add('hidden');
  startBtn.blur(); // so Space/Enter can't re-trigger the button mid-game
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

// Touch joystick
const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const joy = { x: 0, z: 0 }; // values from -1 to 1
const JOY_RADIUS = 45;
let joyPointerId = null;

function updateJoystick(e) {
  const rect = joystickEl.getBoundingClientRect();
  let dx = e.clientX - (rect.left + rect.width / 2);
  let dy = e.clientY - (rect.top + rect.height / 2);

  const dist = Math.hypot(dx, dy);
  if (dist > JOY_RADIUS) {
    dx = (dx / dist) * JOY_RADIUS;
    dy = (dy / dist) * JOY_RADIUS;
  }

  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / JOY_RADIUS;
  joy.z = dy / JOY_RADIUS; // dragging down = +z = toward the camera
}

function resetJoystick() {
  joyPointerId = null;
  joy.x = 0;
  joy.z = 0;
  stickEl.style.transform = 'translate(0px, 0px)';
}

joystickEl.addEventListener('pointerdown', (e) => {
  joyPointerId = e.pointerId;
  joystickEl.setPointerCapture(e.pointerId);
  updateJoystick(e);
});
joystickEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyPointerId) updateJoystick(e);
});
joystickEl.addEventListener('pointerup', resetJoystick);
joystickEl.addEventListener('pointercancel', resetJoystick);

// Game loop
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  // Cap delta so a long pause (hidden tab) doesn't cause a giant jump
  const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  // Only the gameplay logic is gated by state
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
  // no keys held: fall back to the joystick
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

  // Visuals keep running in every state (menu, playing, game over)
  cameraTarget.copy(player.position).add(cameraOffset);
  const t = 1 - Math.exp(-CAMERA_SMOOTHNESS * delta);
  camera.position.lerp(cameraTarget, t);
  camera.lookAt(player.position);

  const time = currentTime / 1000;
  for (const c of collectibles) {
    c.rotation.y += 2 * delta;
    c.position.y = 0.8 + Math.sin(time * 3 + c.userData.phase) * 0.15;
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Keep things correct when the window is resized
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});