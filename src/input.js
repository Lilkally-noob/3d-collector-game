export const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});
window.addEventListener('blur', () => {
    for (const code in keys) keys[code] = false;
});

export const joy = { x: 0, z: 0 };

const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const RING_RADIUS = 60;
const JOY_RADIUS = 45;
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

function endJoystick(e) {
    if (e.pointerId !== activeId) return;
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
    joystickEl.style.left = `${originX - RING_RADIUS}px`;
    joystickEl.style.top = `${originY - RING_RADIUS}px`;
    joystickEl.classList.add('active');
    updateJoystick(e);
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerId === activeId) updateJoystick(e);
});
window.addEventListener('pointerup', endJoystick);
window.addEventListener('pointercancel', endJoystick);