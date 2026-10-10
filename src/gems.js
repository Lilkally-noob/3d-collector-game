import * as THREE from 'three';
import { scene } from './core.js';
import { BOUNDARY } from './arena.js';

const GOOD_COUNT = 5;
const BAD_COUNT = 3;
const MIN_SPAWN_DISTANCE = 3;

export const goodGeometry = new THREE.OctahedronGeometry(0.4);
export const goodMaterial = new THREE.MeshStandardMaterial({
    color: 0x4df2ff,
    emissive: 0x4df2ff,
    emissiveIntensity: 2.0,
    metalness: 0.3,
    roughness: 0.15,
    flatShading: true,
});

export const badGeometry = new THREE.TetrahedronGeometry(0.55);
export const badMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    emissive: 0xff3355,
    emissiveIntensity: 2.0,
    metalness: 0.3,
    roughness: 0.15,
    flatShading: true,
});

export function randomArenaPosition() {
    return {
        x: (Math.random() * 2 - 1) * BOUNDARY,
        z: (Math.random() * 2 - 1) * BOUNDARY,
    };
}

function createGem(type) {
    const isBad = type === 'bad';
    const mesh = new THREE.Mesh(
        isBad ? badGeometry : goodGeometry,
        isBad ? badMaterial : goodMaterial
    );
    const pos = randomArenaPosition();
    mesh.position.set(pos.x, 0.8, pos.z);
    mesh.userData.phase = Math.random() * Math.PI * 2;
    mesh.userData.type = type;
    return mesh;
}

export const collectibles = [];

function addGems(type, count) {
    for (let i = 0; i < count; i++) {
        const gem = createGem(type);
        scene.add(gem);
        collectibles.push(gem);
    }
}

addGems('good', GOOD_COUNT);
addGems('bad', BAD_COUNT);

export function respawnCollectible(c, avoid) {
    let pos;
    for (let i = 0; i < 10; i++) {
        pos = randomArenaPosition();
        if (!avoid || Math.hypot(pos.x - avoid.x, pos.z - avoid.z) > MIN_SPAWN_DISTANCE) break;
    }
    c.position.x = pos.x;
    c.position.z = pos.z;
}

export function animateGems(delta, time) {
    for (const c of collectibles) {
        c.rotation.y += 2 * delta;
        c.position.y = 0.8 + Math.sin(time * 3 + c.userData.phase) * 0.15;
    }
}