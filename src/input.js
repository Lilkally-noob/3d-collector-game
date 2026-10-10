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
const JOY_RADIUS = 45;
let joyPointerId = null;

function updateJoystick(e) {
    const rect = joystickEl.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);

    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
        dx = (dx / dist) * JOY_RADIUS;
        dy = (dy / dist) * JOY_RADIUS;
    }

    stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / JOY_RADIUS;
    joy.z = dy / JOY_RADIUS;
}

function resetJoystick() {
    joyPointerId = null;
    joy.x = 0;
    joy.z = 0;
    stickEl.style.transform = 'translate(0px, 0px)';
}

joystickEl.addEventListener('pointerdown', (e) => {
    joyPointerId = e.pointerId;
    joystickEl.setPointerCapture(e.pointerId);
    updateJoystick(e);
});
joystickEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointerId) updateJoystick(e);
});
joystickEl.addEventListener('pointerup', resetJoystick);
joystickEl.addEventListener('pointercancel', resetJoystick);