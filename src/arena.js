import * as THREE from 'three';
import { scene } from './core.js';

export const ARENA_SIZE = 20;
export const BOUNDARY = ARENA_SIZE / 2 - 0.5;

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x2d6a4f })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);