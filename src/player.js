import * as THREE from 'three';

export function createPlayer() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5;
    return mesh;
}