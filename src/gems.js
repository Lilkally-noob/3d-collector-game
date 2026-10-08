import * as THREE from 'three';
import { scene } from './core.js';
import { BOUNDARY } from './arena.js';

const COLLECTIBLE_COUNT = 5;

const collectibleGeometry = new THREE.OctahedronGeometry(0.4);
const collectibleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4df2ff,
    emissive: 0x4df2ff,
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

function createCollectible() {
    const mesh = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
    const pos = randomArenaPosition();
    mesh.position.set(pos.x, 0.8, pos.z);
    mesh.userData.phase = Math.random() * Math.PI * 2;
    return mesh;
}

export const collectibles = [];
for (let i = 0; i < COLLECTIBLE_COUNT; i++) {
    const c = createCollectible();
    scene.add(c);
    collectibles.push(c);
}

export function respawnCollectible(c) {
    const pos = randomArenaPosition();
    c.position.x = pos.x;
    c.position.z = pos.z;
}

// Spin + bob. `time` is in seconds.
export function animateGems(delta, time) {
    for (const c of collectibles) {
        c.rotation.y += 2 * delta;
        c.position.y = 0.8 + Math.sin(time * 3 + c.userData.phase) * 0.15;
    }
}