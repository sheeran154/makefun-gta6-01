// effects.js — particles, skid marks, floating text, explosions.
// One job: juice. No gameplay logic lives here.

export function makeEffects() {
  return {
    particles: [],
    skids: [],
    floats: [],
    shake: 0,
    flash: 0,
  };
}

export function spawnParticles(fx, x, y, opts = {}) {
  const n = opts.n ?? 12;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (opts.speed ?? 120) * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: opts.life ?? 0.6, maxLife: opts.life ?? 0.6,
      size: (opts.size ?? 4) * (0.6 + Math.random() * 0.8),
      color: opts.color ?? '#ffcf4d',
      gravity: opts.gravity ?? 0,
    });
  }
}

export function spawnExplosion(fx, x, y) {
  spawnParticles(fx, x, y, { n: 40, speed: 320, life: 0.9, size: 7, color: '#ff7b1c' });
  spawnParticles(fx, x, y, { n: 24, speed: 180, life: 1.2, size: 9, color: '#3a3a3a' });
  spawnParticles(fx, x, y, { n: 16, speed: 420, life: 0.4, size: 4, color: '#ffe66d' });
  fx.shake = Math.max(fx.shake, 14);
  fx.flash = 0.25;
}

export function addSkid(fx, x, y, angle) {
  fx.skids.push({ x, y, angle, life: 4 });
  if (fx.skids.length > 400) fx.skids.shift();
}

export function addFloat(fx, x, y, text, color) {
  fx.floats.push({ x, y, text, color: color ?? '#fff', life: 1.4 });
}

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= (1 - 2 * dt); p.vy *= (1 - 2 * dt);
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter((s) => s.life > 0);
  for (const f of fx.floats) { f.life -= dt; f.y -= 34 * dt; }
  fx.floats = fx.floats.filter((f) => f.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt);
}
