import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = '/models/player.glb';
const TARGET_HEIGHT = 1.7;

export function createPlayer() {
    const group = new THREE.Group();
    group.position.y = 0.5;

    const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    group.add(placeholder);

    let mixer = null;
    let current = null;
    let wanted = 'idle';
    const actions = {};

    function play(name) {
        const next = actions[name];
        if (!next || next === current) return;
        next.reset().fadeIn(0.2).play();
        if (current) current.fadeOut(0.2);
        current = next;
    }

    new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const scale = TARGET_HEIGHT / (box.max.y - box.min.y);
            model.scale.setScalar(scale);
            model.position.y = -0.5 - box.min.y * scale;
            model.scale.setScalar(scale);
            model.rotation.y = Math.PI;

            group.remove(placeholder);
            group.add(model);

            mixer = new THREE.AnimationMixer(model);
            const find = (re) => gltf.animations.find((a) => re.test(a.name));
            const idleClip = find(/idle/i) ?? gltf.animations[0];
            const runClip = find(/run/i) ?? idleClip;
            if (idleClip) actions.idle = mixer.clipAction(idleClip);
            if (runClip) actions.run = mixer.clipAction(runClip);

            console.log('Player animations:', gltf.animations.map((a) => a.name));
            play(wanted);
        },
        undefined,
        (err) => console.warn('Player model failed to load, keeping the cube', err)
    );

    group.userData.setState = (name) => {
        wanted = name;
        play(name);
    };
    group.userData.update = (delta) => {
        if (mixer) mixer.update(delta);
    };

    return group;
}