// combat.js — shooting: bullets, muzzle flash, damage, car explosions.
// One job: the gunplay.

export function makeCombat() {
  return {
    bullets: [],
    fireCooldown: 0,
    muzzle: 0,
    ammo: Infinity, // pistol never runs dry; pickups grant the SMG instead
    weapon: 'pistol', // pistol | smg
    smgTimer: 0,
  };
}

const WEAPONS = {
  pistol: { rate: 0.22, speed: 900, damage: 34, spread: 0.03, range: 520 },
  smg: { rate: 0.07, speed: 1000, damage: 20, spread: 0.09, range: 460 },
};

/** Fire one shot from (x, y) toward angle. Returns true if a shot left the barrel. */
export function tryFire(combat, x, y, angle, dt) {
  combat.fireCooldown -= dt;
  combat.muzzle = Math.max(0, combat.muzzle - dt * 4);
  if (combat.fireCooldown > 0) return false;
  const w = WEAPONS[combat.weapon];
  combat.fireCooldown = w.rate;
  combat.muzzle = 1;
  const a = angle + (Math.random() - 0.5) * w.spread * 2;
  combat.bullets.push({
    x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18,
    vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
    life: w.range / w.speed, damage: w.damage,
  });
  return true;
}

export function updateBullets(combat, dt, hitFn) {
  for (const b of combat.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (hitFn) hitFn(b);
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  if (combat.weapon === 'smg') {
    combat.smgTimer -= dt;
    if (combat.smgTimer <= 0) combat.weapon = 'pistol';
  }
}

/** Grant the SMG for a while (from a pickup). */
export function grantSmg(combat, seconds) {
  combat.weapon = 'smg';
  combat.smgTimer = Math.max(combat.smgTimer, seconds);
}
