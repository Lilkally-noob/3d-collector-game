import * as THREE from 'three';
import { scene } from './core.js';
import { BOUNDARY } from './arena.js';

const GOOD_COUNT = 5;
const BAD_COUNT = 3;
const MIN_SPAWN_DISTANCE = 3;

function createCoinTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#c98a12';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 36, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#c98a12';
    ctx.beginPath();
    ctx.moveTo(64, 44);
    ctx.lineTo(80, 64);
    ctx.lineTo(64, 84);
    ctx.lineTo(48, 64);
    ctx.closePath();
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const coinTexture = createCoinTexture();

const coinEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0a020,
    emissive: 0xffa800,
    emissiveIntensity: 1.5,
    metalness: 0.4,
    roughness: 0.35,
});
const coinFaceMaterial = new THREE.MeshStandardMaterial({
    map: coinTexture,
    emissive: 0xffffff,
    emissiveMap: coinTexture,
    emissiveIntensity: 1.8,
    metalness: 0.4,
    roughness: 0.35,
});

export const goodGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 32).rotateX(Math.PI / 2);
export const goodMaterial = [coinEdgeMaterial, coinFaceMaterial, coinFaceMaterial];

export const badGeometry = new THREE.SphereGeometry(0.5, 24, 24);
export const badMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    emissive: 0xff1a3d,
    emissiveIntensity: 2.0,
    metalness: 0.1,
    roughness: 0.35,
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