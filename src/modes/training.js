import * as THREE from 'three';
import { scene } from '../core.js';
import { BOUNDARY, ground } from '../arena.js';
import { keys, joy } from '../input.js';
import { createPlayer } from '../player.js';
import { collectibles, respawnCollectible, animateGems } from '../gems.js';
import { loadNumber, saveNumber } from '../storage.js';

const player = createPlayer();
scene.add(player);

const PLAYER_SPEED = 8;
const COLLECT_DISTANCE = 1.0;
const BAD_PENALTY = 5;
const DURATIONS = [15, 30, 60];

const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');
const bestTextEl = document.getElementById('bestText');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const flashEl = document.getElementById('flash');
const durBtns = document.querySelectorAll('.durBtn');

let phase = 'ready';
let score = 0;
let coins = 0;
let best = 0;
const savedDuration = loadNumber('training:duration', 30);
let gameDuration = DURATIONS.includes(savedDuration) ? savedDuration : 30;
let timeLeft = gameDuration;

function setWorldVisible(visible) {
    ground.visible = visible;
    player.visible = visible;
    for (const c of collectibles) c.visible = visible;
}

function flashRed() {
    flashEl.classList.remove('active');
    void flashEl.offsetWidth;
    flashEl.classList.add('active');
}

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

function resetRound() {
    score = 0;
    scoreEl.textContent = score;
    coins = 0;
    coinsEl.textContent = coins;
    timeLeft = gameDuration;
    timerEl.textContent = gameDuration;

    player.position.set(0, 0.5, 0);
    player.rotation.y = Math.PI;
    for (const k in keys) keys[k] = false;
    for (const c of collectibles) respawnCollectible(c, player.position);
}

function showReadyScreen() {
    phase = 'ready';
    overlayTitleEl.textContent = 'Training';
    overlayTextEl.textContent =
        'WASD or arrows to move. Grab the gold coins, avoid the red orbs (-5).';
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
    overlayTextEl.textContent = `Final score: ${score} · ${coins} coins`;
    startBtn.textContent = 'Play again';
    overlayEl.classList.remove('hidden');
}

startBtn.addEventListener('click', startGame);

setWorldVisible(false);
selectDuration(gameDuration);

export const training = {
    focus: player,
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
        player.userData.update(delta);

        if (phase !== 'playing') {
            player.userData.setState('idle');
            return;
        }

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

        const moving = Math.hypot(moveX, moveZ) > 0.1;
        player.userData.setState(moving ? 'run' : 'idle');
        if (moving) {
            const targetYaw = Math.atan2(moveX, moveZ);
            let diff = targetYaw - player.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            player.rotation.y += diff * Math.min(1, 12 * delta);
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
                    coins += 1;
                    coinsEl.textContent = coins;
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