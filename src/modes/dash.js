import * as THREE from 'three';
import { scene, camera } from '../core.js';
import { keys, joy } from '../input.js';
import { createPlayer } from '../player.js';
import { goodGeometry, goodMaterial, badGeometry, badMaterial } from '../gems.js';
import { loadNumber, saveNumber } from '../storage.js';

const ROAD_WIDTH = 10;
const MAX_X = ROAD_WIDTH / 2 - 0.7;
const TILE_LENGTH = 20;
const TILE_COUNT = 8;
const STEER_SPEED = 9;
const START_SPEED = 12;
const MAX_SPEED = 28;
const ACCELERATION = 0.35;
const LOOK_AHEAD = 7;

const GEM_COUNT = 16;
const GEM_SPACING = 8;
const GEM_START_Z = -30;
const GEM_Y = 0.9;
const GEM_VALUE = 10;
const RECYCLE_BEHIND = 10;
const HIT_X = 0.9;
const HIT_Z = 0.9;

const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const timeRow = document.getElementById('timer').parentElement;
const flashEl = document.getElementById('flash');
const dashOverlayEl = document.getElementById('dashOverlay');
const dashTitleEl = document.getElementById('dashTitle');
const dashTextEl = document.getElementById('dashText');
const dashBestTextEl = document.getElementById('dashBestText');
const dashStartBtn = document.getElementById('dashStartBtn');
const quitBtn = document.getElementById('quitBtn');

const world = new THREE.Group();
world.visible = false;
scene.add(world);

const sideFloorGeo = new THREE.PlaneGeometry(90, TILE_LENGTH);
const sideFloorMat = new THREE.MeshStandardMaterial({ color: 0x0c0c24 });
const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, TILE_LENGTH);
const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1b1b3a,
    roughness: 0.6,
    metalness: 0.3,
});
const edgeGeo = new THREE.BoxGeometry(0.2, 0.2, TILE_LENGTH);
const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x4df2ff,
    emissive: 0x4df2ff,
    emissiveIntensity: 2,
});
const pillarGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
const pillarMatLeft = new THREE.MeshStandardMaterial({
    color: 0xff2fd6,
    emissive: 0xff2fd6,
    emissiveIntensity: 2,
});
const pillarMatRight = new THREE.MeshStandardMaterial({
    color: 0x2fd6ff,
    emissive: 0x2fd6ff,
    emissiveIntensity: 2,
});

function randomizePillars(tile) {
    for (const p of tile.userData.pillars) {
        const h = 2 + Math.random() * 6;
        p.scale.y = h;
        p.position.y = h / 2;
        p.position.z = (Math.random() - 0.5) * (TILE_LENGTH - 2);
    }
}

function createTile() {
    const tile = new THREE.Group();

    const side = new THREE.Mesh(sideFloorGeo, sideFloorMat);
    side.rotation.x = -Math.PI / 2;
    side.position.y = -0.02;
    tile.add(side);

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    tile.add(road);

    for (const sign of [-1, 1]) {
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(sign * (ROAD_WIDTH / 2), 0.1, 0);
        tile.add(edge);
    }

    tile.userData.pillars = [];
    for (const sign of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, sign < 0 ? pillarMatLeft : pillarMatRight);
        pillar.position.x = sign * (ROAD_WIDTH / 2 + 3);
        tile.add(pillar);
        tile.userData.pillars.push(pillar);
    }

    randomizePillars(tile);
    return tile;
}

const tiles = [];
for (let i = 0; i < TILE_COUNT; i++) {
    const tile = createTile();
    world.add(tile);
    tiles.push(tile);
}

const gems = [];
for (let i = 0; i < GEM_COUNT; i++) {
    const gem = new THREE.Mesh(goodGeometry, goodMaterial);
    gem.userData.phase = Math.random() * Math.PI * 2;
    world.add(gem);
    gems.push(gem);
}

const player = createPlayer();
world.add(player);

const focus = new THREE.Object3D();
const cameraOffset = new THREE.Vector3(0, 6, 15);

let phase = 'ready';
let speed = START_SPEED;
let distance = 0;
let gemsCollected = 0;
let score = 0;
let best = loadNumber('dash:best', 0);

const saved = { background: null, fog: null };

function badChance() {
    return Math.min(0.5, 0.2 + distance / 4000);
}

function placeGem(gem, z) {
    const isBad = Math.random() < badChance();
    gem.geometry = isBad ? badGeometry : goodGeometry;
    gem.material = isBad ? badMaterial : goodMaterial;
    gem.userData.type = isBad ? 'bad' : 'good';
    gem.position.set((Math.random() * 2 - 1) * MAX_X, GEM_Y, z);
}

function recycleGems() {
    let minZ = Infinity;
    for (const g of gems) minZ = Math.min(minZ, g.position.z);

    for (const g of gems) {
        if (g.position.z - player.position.z > RECYCLE_BEHIND) {
            minZ -= GEM_SPACING;
            placeGem(g, minZ);
        }
    }
}

function flashRed() {
    flashEl.classList.remove('active');
    void flashEl.offsetWidth;
    flashEl.classList.add('active');
}

function renderBest() {
    bestEl.textContent = best;
    dashBestTextEl.textContent = best > 0 ? `Best: ${best}` : '';
}

function resetRun() {
    speed = START_SPEED;
    distance = 0;
    gemsCollected = 0;
    score = 0;

    player.position.set(0, 0.5, 0);
    player.rotation.set(0, 0, 0);

    tiles.forEach((tile, i) => {
        tile.position.set(0, 0, TILE_LENGTH - i * TILE_LENGTH);
        randomizePillars(tile);
    });

    gems.forEach((gem, i) => placeGem(gem, GEM_START_Z - i * GEM_SPACING));

    scoreEl.textContent = 0;
    for (const k in keys) keys[k] = false;
}

function showReady() {
    phase = 'ready';
    resetRun();
    renderBest();
    dashTitleEl.textContent = 'Endless Dash';
    dashTextEl.textContent =
        'Steer with A / D or the arrow keys (the joystick on phones). Cyan gems are +10. Hit a red gem and the run is over.';
    dashStartBtn.textContent = 'Press to start';
    quitBtn.classList.add('hidden');
    dashOverlayEl.classList.remove('hidden');
}

function startRun() {
    resetRun();
    dashOverlayEl.classList.add('hidden');
    quitBtn.classList.remove('hidden');
    dashStartBtn.blur();
    phase = 'running';
}

function crash() {
    phase = 'dead';
    flashRed();

    const isNewBest = score > best;
    if (isNewBest) {
        best = score;
        saveNumber('dash:best', best);
    }
    renderBest();

    dashTitleEl.textContent = isNewBest ? 'New high score!' : 'Crashed!';
    dashTextEl.textContent = `Score ${score} · ${Math.floor(distance)}m · ${gemsCollected} gems`;
    dashStartBtn.textContent = 'Run again';
    quitBtn.classList.add('hidden');
    dashOverlayEl.classList.remove('hidden');
}

dashStartBtn.addEventListener('click', startRun);
quitBtn.addEventListener('click', showReady);

export const dash = {
    focus,
    cameraOffset,
    cameraSmoothness: 12,

    enter() {
        saved.background = scene.background;
        saved.fog = scene.fog;
        scene.background = new THREE.Color(0x07071a);
        scene.fog = new THREE.Fog(0x07071a, 25, 95);

        world.visible = true;
        hudEl.classList.remove('hidden');
        timeRow.classList.add('hidden');

        best = loadNumber('dash:best', 0);
        focus.position.set(0, 1, -LOOK_AHEAD);
        camera.position.copy(focus.position).add(cameraOffset);
        camera.lookAt(focus.position);

        showReady();
    },

    exit() {
        scene.background = saved.background;
        scene.fog = saved.fog;

        world.visible = false;
        hudEl.classList.add('hidden');
        timeRow.classList.remove('hidden');
        dashOverlayEl.classList.add('hidden');
        quitBtn.classList.add('hidden');
        phase = 'ready';
        for (const k in keys) keys[k] = false;
    },

    update(delta, time) {
        for (const g of gems) {
            g.rotation.y += 2 * delta;
            g.position.y = GEM_Y + Math.sin(time * 3 + g.userData.phase) * 0.15;
        }

        if (phase === 'running') {
            let steer = 0;
            if (keys['KeyA'] || keys['ArrowLeft']) steer -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) steer += 1;
            if (steer === 0) steer = joy.x;

            player.position.x += steer * STEER_SPEED * delta;
            player.position.x = THREE.MathUtils.clamp(player.position.x, -MAX_X, MAX_X);

            const targetLean = -steer * 0.35;
            player.rotation.z += (targetLean - player.rotation.z) * Math.min(1, 10 * delta);

            speed = Math.min(MAX_SPEED, speed + ACCELERATION * delta);
            player.position.z -= speed * delta;
            distance = -player.position.z;

            for (const tile of tiles) {
                if (tile.position.z - player.position.z > TILE_LENGTH * 1.5) {
                    tile.position.z -= TILE_LENGTH * TILE_COUNT;
                    randomizePillars(tile);
                }
            }

            for (const g of gems) {
                const dx = player.position.x - g.position.x;
                const dz = player.position.z - g.position.z;
                if (Math.abs(dx) < HIT_X && Math.abs(dz) < HIT_Z + speed * delta) {
                    if (g.userData.type === 'bad') {
                        score = Math.floor(distance) + gemsCollected * GEM_VALUE;
                        crash();
                        break;
                    }
                    gemsCollected += 1;
                    g.position.z = player.position.z + RECYCLE_BEHIND + 1;
                }
            }

            if (phase === 'running') {
                recycleGems();
                score = Math.floor(distance) + gemsCollected * GEM_VALUE;
                scoreEl.textContent = score;
            }
        }

        focus.position.set(player.position.x, 1, player.position.z - LOOK_AHEAD);
    },
};