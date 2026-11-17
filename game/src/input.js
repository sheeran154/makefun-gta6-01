// input.js — keyboard + mouse state for PORT SOLARA.
// One job: track what the player is pressing, nothing else.
// Held keys live in `keys`; a quick tap also sets an edge flag in `pressed`
// that stays until consume() reads it, so a tap between frames is never lost.

export const keys = Object.create(null);
export const pressed = Object.create(null);
export const mouse = { x: 0, y: 0, down: false, clicked: false };

const CODE_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
  KeyE: 'enter',
  KeyM: 'phone',
  Escape: 'pause',
  KeyR: 'respawn',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const name = CODE_MAP[e.code];
    if (name) {
      keys[name] = true;
      pressed[name] = true;
      if (name === 'brake' || name === 'pause') e.preventDefault();
    }
    if (e.code === 'Enter') { keys.enter = true; pressed.enter = true; }
  });
  window.addEventListener('keyup', (e) => {
    const name = CODE_MAP[e.code];
    if (name) keys[name] = false;
    if (e.code === 'Enter') keys.enter = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  // Keep focus so keys keep working after a click.
  canvas.addEventListener('click', () => canvas.focus());
}

/** True once for a tap of the key; call after reading. */
export function consume(name) {
  if (pressed[name]) { pressed[name] = false; return true; }
  return false;
}

export function consumeClick() {
  if (mouse.clicked) { mouse.clicked = false; return true; }
  return false;
}
