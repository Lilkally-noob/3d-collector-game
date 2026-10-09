import * as THREE from 'three';
import { scene } from '../core.js';
import { BOUNDARY, ground } from '../arena.js';
import { keys, joy } from '../input.js';
import { createPlayer } from '../player.js';
import { collectibles, respawnCollectible, animateGems } from '../gems.js';
import { loadNumber, saveNumber } from '../storage.js';

// Player
const player = createPlayer();
scene.add(player);

// Settings
const PLAYER_SPEED = 8;
const COLLECT_DISTANCE = 1.0;
const BAD_PENALTY = 5;
const DURATIONS = [15, 30, 60];

// UI elements
const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');
const bestTextEl = document.getElementById('bestText');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const flashEl = document.getElementById('flash');
const durBtns = document.querySelectorAll('.durBtn');

// State
let phase = 'ready'; // 'ready' | 'playing' | 'gameover'
let score = 0;
let best = 0;
const savedDuration = loadNumber('training:duration', 30);
let gameDuration = DURATIONS.includes(savedDuration) ? savedDuration : 30;
let timeLeft = gameDuration;

// World visibility (so other modes can hide training's world)
function setWorldVisible(visible) {
    ground.visible = visible;
    player.visible = visible;
    for (const c of collectibles) c.visible = visible;
}

function flashRed() {
    flashEl.classList.remove('active');
    void flashEl.offsetWidth; // forces the browser to reset so the animation can replay
    flashEl.classList.add('active');
}

// High score + duration picker
function bestKey() {
    return `training:best:${gameDuration}`;
}

function renderBest() {
    bestEl.textContent = best;
    bestTextEl.textContent = best > 0 ? `Best (${gameDuration}s): ${best}` : '';
}

function selectDuration(seconds) {
    gameDuration = seconds;
    saveNumber('training:duration', seconds);
    durBtns.forEach((b) =>
        b.classList.toggle('active', Number(b.dataset.seconds) === seconds)
    );
    timerEl.textContent = seconds;
    best = loadNumber(bestKey(), 0);
    renderBest();
}

durBtns.forEach((b) =>
    b.addEventListener('click', () => selectDuration(Number(b.dataset.seconds)))
);

// Round lifecycle
function resetRound() {
    score = 0;
    scoreEl.textContent = score;
    timeLeft = gameDuration;
    timerEl.textContent = gameDuration;

    player.position.set(0, 0.5, 0);
    for (const k in keys) keys[k] = false;
    for (const c of collectibles) respawnCollectible(c, player.position);
}

function showReadyScreen() {
    phase = 'ready';
    overlayTitleEl.textContent = 'Training';
    overlayTextEl.textContent =
        'WASD or arrows to move. Grab the cyan gems, avoid the red ones (-5).';
    startBtn.textContent = 'Press to start';
    overlayEl.classList.remove('hidden');
}

function startGame() {
    resetRound();
    overlayEl.classList.add('hidden');
    startBtn.blur();
    phase = 'playing';
}

function endGame() {
    phase = 'gameover';

    const isNewBest = score > best;
    if (isNewBest) {
        best = score;
        saveNumber(bestKey(), best);
    }
    renderBest();

    overlayTitleEl.textContent = isNewBest ? 'New high score!' : "Time's up!";
    overlayTextEl.textContent = `Final score: ${score}`;
    startBtn.textContent = 'Play again';
    overlayEl.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);

// Start hidden; main.js calls enter() when the player picks this mode
setWorldVisible(false);
selectDuration(gameDuration);

// The "mode contract": main.js only relies on these four things
export const training = {
    focus: player, // what the camera follows
    cameraOffset: new THREE.Vector3(0, 10, 12),

    enter() {
        setWorldVisible(true);
        hudEl.classList.remove('hidden');
        resetRound();
        selectDuration(gameDuration);
        showReadyScreen();
    },

    exit() {
        setWorldVisible(false);
        hudEl.classList.add('hidden');
        overlayEl.classList.add('hidden');
        phase = 'ready';
        for (const k in keys) keys[k] = false;
    },

    update(delta, time) {
        animateGems(delta, time);

        if (phase !== 'playing') return;

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
                if (c.userData.type === 'bad') {
                    score = Math.max(0, score - BAD_PENALTY);
                    flashRed();
                } else {
                    score += 1;
                }
                scoreEl.textContent = score;
                respawnCollectible(c, player.position);
            }
        }

        timeLeft -= delta;
        if (timeLeft <= 0) {
            timeLeft = 0;
            endGame();
        }
        timerEl.textContent = Math.ceil(timeLeft);
    },
};