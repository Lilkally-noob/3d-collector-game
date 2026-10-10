import * as THREE from 'three';
import { scene, camera, ambientLight, sunLight } from '../core.js';
import { keys, setTouchMode, consumeLaneMove, clearLaneMoves } from '../input.js';
import { createPlayer } from '../player.js';
import { goodGeometry, goodMaterial, badGeometry, badMaterial } from '../gems.js';
import { loadNumber, saveNumber } from '../storage.js';

const ROAD_WIDTH = 10;
const LANE_WIDTH = 3.4;
const LANE_SMOOTHNESS = 14;
const TILE_LENGTH = 20;
const TILE_COUNT = 8;
const START_SPEED = 12;
const MAX_SPEED = 28;
const ACCELERATION = 0.35;
const LOOK_AHEAD = 7;
const FOV_BASE = 60;
const FOV_BOOST = 14;

const GEM_COUNT = 16;
const GEM_SPACING = 8;
const GEM_START_Z = -30;
const GEM_Y = 0.9;
const GEM_VALUE = 10;
const RECYCLE_BEHIND = 10;
const HIT_X = 0.9;
const HIT_Z = 0.9;

const SKY_HORIZON = 0xf7a46a;
const SKY_MIDDLE = 0x9a5f8f;
const SKY_ZENITH = 0x101a3d;
const FOG_NEAR = 30;
const FOG_FAR = 150;
const SUN_DISTANCE = 380;
const SUN_HEIGHT = 34;

const DASH_AMBIENT_COLOR = 0x8a6f9a;
const DASH_AMBIENT_INTENSITY = 0.9;
const DASH_SUN_COLOR = 0xffb878;
const DASH_SUN_INTENSITY = 2.4;

const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
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
const sideFloorMat = new THREE.MeshStandardMaterial({ color: 0x241d2b, roughness: 1 });
const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, TILE_LENGTH);

function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#44444c';
    ctx.fillRect(0, 0, 128, 256);

    for (let i = 0; i < 900; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(Math.random() * 128, Math.random() * 256, 1, 1);
    }

    ctx.fillStyle = '#d8d0bc';
    for (let y = 0; y < 256; y += 64) {
        ctx.fillRect(41, y, 3, 32);
        ctx.fillRect(84, y, 3, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

const roadMat = new THREE.MeshStandardMaterial({
    map: createRoadTexture(),
    roughness: 0.95,
    metalness: 0,
});
const curbGeo = new THREE.BoxGeometry(0.4, 0.2, TILE_LENGTH);
const curbMat = new THREE.MeshStandardMaterial({ color: 0x4a464f, roughness: 0.9 });

const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
const buildingMats = [
    new THREE.MeshStandardMaterial({ color: 0x17131f, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x1f1a2b, roughness: 1 }),
];

function randomizeBuildings(tile) {
    for (const b of tile.userData.buildings) {
        const w = 3 + Math.random() * 4;
        const d = 3 + Math.random() * 4;
        const h = 6 + Math.random() * 22;
        b.mesh.scale.set(w, h, d);
        b.mesh.position.set(
            b.side * (ROAD_WIDTH / 2 + 3 + w / 2 + Math.random() * 5),
            h / 2,
            b.slot + (Math.random() - 0.5) * (10 - d)
        );
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
        const curb = new THREE.Mesh(curbGeo, curbMat);
        curb.position.set(sign * (ROAD_WIDTH / 2 + 0.2), 0.1, 0);
        tile.add(curb);
    }

    tile.userData.buildings = [];
    for (const side of [-1, 1]) {
        for (const slot of [-5, 5]) {
            const mesh = new THREE.Mesh(
                buildingGeo,
                buildingMats[Math.floor(Math.random() * buildingMats.length)]
            );
            tile.add(mesh);
            tile.userData.buildings.push({ mesh, side, slot });
        }
    }

    randomizeBuildings(tile);
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

const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
        horizon: { value: new THREE.Color(SKY_HORIZON) },
        middle: { value: new THREE.Color(SKY_MIDDLE) },
        zenith: { value: new THREE.Color(SKY_ZENITH) },
    },
    vertexShader: `
        varying vec3 vDir;
        void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 horizon;
        uniform vec3 middle;
        uniform vec3 zenith;
        varying vec3 vDir;
        void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 color = mix(horizon, middle, smoothstep(0.0, 0.25, h));
            color = mix(color, zenith, smoothstep(0.2, 0.8, h));
            gl_FragColor = vec4(color, 1.0);
            #include <colorspace_fragment>
        }
    `,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
sky.renderOrder = -10;
sky.frustumCulled = false;
world.add(sky);

const STAR_COUNT = 600;
const starPositions = new Float32Array(STAR_COUNT * 3);
const starColors = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const elevation = 0.18 + Math.random() * 0.82;
    const flat = Math.sqrt(1 - elevation * elevation);
    starPositions[i * 3] = Math.cos(angle) * flat * 450;
    starPositions[i * 3 + 1] = elevation * 450;
    starPositions[i * 3 + 2] = Math.sin(angle) * flat * 450;

    const fade = THREE.MathUtils.smoothstep(elevation, 0.18, 0.6);
    const brightness = (0.35 + Math.random() * 0.65) * fade;
    const tint = Math.random();
    starColors[i * 3] = brightness * (0.8 + 0.2 * tint);
    starColors[i * 3 + 1] = brightness * 0.9;
    starColors[i * 3 + 2] = brightness * (1 - 0.2 * tint);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, fog: false })
);
world.add(stars);

const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe3a6, fog: false });
sunMat.color.multiplyScalar(1.6);
const sun = new THREE.Mesh(new THREE.CircleGeometry(22, 48), sunMat);
world.add(sun);

function createHaloTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 190, 110, 0.85)');
    gradient.addColorStop(0.35, 'rgba(255, 150, 80, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({
        map: createHaloTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
    })
);
world.add(halo);

const focus = new THREE.Object3D();
const cameraOffset = new THREE.Vector3(0, 6, 15);

let phase = 'ready';
let speed = START_SPEED;
let distance = 0;
let gemsCollected = 0;
let score = 0;
let lane = 0;
let best = loadNumber('dash:best', 0);

const saved = {};

function badChance() {
    return Math.min(0.5, 0.2 + distance / 4000);
}

function placeGem(gem, z) {
    const isBad = Math.random() < badChance();
    const gemLane = Math.floor(Math.random() * 3) - 1;
    gem.geometry = isBad ? badGeometry : goodGeometry;
    gem.material = isBad ? badMaterial : goodMaterial;
    gem.userData.type = isBad ? 'bad' : 'good';
    gem.position.set(gemLane * LANE_WIDTH, GEM_Y, z);
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
    lane = 0;

    player.position.set(0, 0.5, 0);
    player.rotation.set(0, Math.PI, 0);

    tiles.forEach((tile, i) => {
        tile.position.set(0, 0, TILE_LENGTH - i * TILE_LENGTH);
        randomizeBuildings(tile);
    });

    gems.forEach((gem, i) => placeGem(gem, GEM_START_Z - i * GEM_SPACING));

    scoreEl.textContent = 0;
    coinsEl.textContent = 0;
    for (const k in keys) keys[k] = false;
    clearLaneMoves();
}

function showReady() {
    phase = 'ready';
    resetRun();
    renderBest();
    dashTitleEl.textContent = 'Endless Dash';
    dashTextEl.textContent =
        'Swipe left or right (or tap A / D or the arrow keys) to change lanes. Gold coins are +10. Hit a red orb and the run is over.';
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
    dashTextEl.textContent = `Score ${score} · ${Math.floor(distance)}m · ${gemsCollected} coins`;
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
        saved.ambientColor = ambientLight.color.clone();
        saved.ambientIntensity = ambientLight.intensity;
        saved.sunColor = sunLight.color.clone();
        saved.sunIntensity = sunLight.intensity;
        saved.sunPosition = sunLight.position.clone();

        scene.background = new THREE.Color(SKY_HORIZON);
        scene.fog = new THREE.Fog(SKY_HORIZON, FOG_NEAR, FOG_FAR);
        ambientLight.color.set(DASH_AMBIENT_COLOR);
        ambientLight.intensity = DASH_AMBIENT_INTENSITY;
        sunLight.color.set(DASH_SUN_COLOR);
        sunLight.intensity = DASH_SUN_INTENSITY;
        sunLight.position.set(-10, 14, 18);

        camera.fov = FOV_BASE;
        camera.updateProjectionMatrix();
        setTouchMode('swipe');

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
        ambientLight.color.copy(saved.ambientColor);
        ambientLight.intensity = saved.ambientIntensity;
        sunLight.color.copy(saved.sunColor);
        sunLight.intensity = saved.sunIntensity;
        sunLight.position.copy(saved.sunPosition);

        camera.fov = FOV_BASE;
        camera.updateProjectionMatrix();
        setTouchMode('stick');

        world.visible = false;
        hudEl.classList.add('hidden');
        timeRow.classList.remove('hidden');
        dashOverlayEl.classList.add('hidden');
        quitBtn.classList.add('hidden');
        phase = 'ready';
        for (const k in keys) keys[k] = false;
        clearLaneMoves();
    },

    update(delta, time) {
        for (const g of gems) {
            g.rotation.y += 2 * delta;
            g.position.y = GEM_Y + Math.sin(time * 3 + g.userData.phase) * 0.15;
        }

        player.userData.update(delta);
        player.userData.setState(phase === 'running' ? 'run' : 'idle');

        if (phase !== 'running') clearLaneMoves();

        if (phase === 'running') {
            const move = consumeLaneMove();
            if (move !== 0) lane = THREE.MathUtils.clamp(lane + move, -1, 1);

            const prevX = player.position.x;
            player.position.x += (lane * LANE_WIDTH - prevX) * Math.min(1, LANE_SMOOTHNESS * delta);

            const velocityX = delta > 0 ? (player.position.x - prevX) / delta : 0;
            const targetLean = THREE.MathUtils.clamp(velocityX * 0.04, -0.35, 0.35);
            player.rotation.z += (targetLean - player.rotation.z) * Math.min(1, 10 * delta);

            speed = Math.min(MAX_SPEED, speed + ACCELERATION * delta);
            player.position.z -= speed * delta;
            distance = -player.position.z;

            for (const tile of tiles) {
                if (tile.position.z - player.position.z > TILE_LENGTH * 1.5) {
                    tile.position.z -= TILE_LENGTH * TILE_COUNT;
                    randomizeBuildings(tile);
                }
            }

            for (const g of gems) {
                const dx = player.position.x - g.position.x;
                const dz = player.position.z - g.position.z;
                if (Math.abs(dx) < HIT_X && dz < HIT_Z && dz > -(HIT_Z + speed * delta)) {
                    if (g.userData.type === 'bad') {
                        score = Math.floor(distance) + gemsCollected * GEM_VALUE;
                        crash();
                        break;
                    }
                    gemsCollected += 1;
                    coinsEl.textContent = gemsCollected;
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
        sky.position.set(player.position.x, 0, player.position.z);
        stars.position.set(player.position.x, 0, player.position.z);
        sun.position.set(player.position.x, SUN_HEIGHT, player.position.z - SUN_DISTANCE);
        halo.position.set(player.position.x, SUN_HEIGHT, player.position.z - SUN_DISTANCE - 1);

        const speedRatio = phase === 'running' ? (speed - START_SPEED) / (MAX_SPEED - START_SPEED) : 0;
        camera.fov += (FOV_BASE + speedRatio * FOV_BOOST - camera.fov) * Math.min(1, 3 * delta);
        camera.updateProjectionMatrix();
    },
};