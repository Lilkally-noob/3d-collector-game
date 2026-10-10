export const keys = {};
export const joy = { x: 0, z: 0 };

let laneQueue = 0;
let touchMode = 'stick';

function pushLane(dir) {
    laneQueue = Math.max(-2, Math.min(2, laneQueue + dir));
}

export function consumeLaneMove() {
    if (laneQueue === 0) return 0;
    const step = Math.sign(laneQueue);
    laneQueue -= step;
    return step;
}

export function clearLaneMoves() {
    laneQueue = 0;
}

export function setTouchMode(mode) {
    touchMode = mode;
    endTouch();
}

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') pushLane(-1);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') pushLane(1);
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});
window.addEventListener('blur', () => {
    for (const code in keys) keys[code] = false;
});

const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const RING_RADIUS = 60;
const JOY_RADIUS = 45;
const SWIPE_DISTANCE = 35;
let activeId = null;
let originX = 0;
let originY = 0;

function updateJoystick(e) {
    let dx = e.clientX - originX;
    let dy = e.clientY - originY;

    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
        dx = (dx / dist) * JOY_RADIUS;
        dy = (dy / dist) * JOY_RADIUS;
    }

    stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / JOY_RADIUS;
    joy.z = dy / JOY_RADIUS;
}

function endTouch() {
    activeId = null;
    joy.x = 0;
    joy.z = 0;
    stickEl.style.transform = 'translate(0px, 0px)';
    joystickEl.classList.remove('active');
}

window.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    if (e.pointerType === 'mouse') return;
    if (e.target.tagName !== 'CANVAS') return;

    activeId = e.pointerId;
    originX = e.clientX;
    originY = e.clientY;

    if (touchMode === 'stick') {
        joystickEl.style.left = `${originX - RING_RADIUS}px`;
        joystickEl.style.top = `${originY - RING_RADIUS}px`;
        joystickEl.classList.add('active');
        updateJoystick(e);
    }
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;

    if (touchMode === 'stick') {
        updateJoystick(e);
        return;
    }

    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        pushLane(Math.sign(dx));
        originX = e.clientX;
        originY = e.clientY;
    }
});

function onTouchEnd(e) {
    if (e.pointerId === activeId) endTouch();
}
window.addEventListener('pointerup', onTouchEnd);
window.addEventListener('pointercancel', onTouchEnd);