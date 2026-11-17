// police.js — the wanted level and the Solara PD response.
// One job: heat, cops, busts. Wanted 0–5 stars; cops spawn, chase, ram, and
// on foot they close in and beat the player down.

import { makeCar, CAR_TYPES } from './vehicles.js';
import { randomRoadPoint } from './city.js';

const COP_TYPE = CAR_TYPES.find((t) => t.police);

export function makeWanted() {
  return {
    stars: 0,
    heat: 0,          // 0..100 within the current star level
    coolTimer: 0,     // seconds without a crime; heat bleeds off
    bustedTimer: 0,
  };
}

/** Add heat; stars rise at thresholds 20/45/70/90/100. */
export function addHeat(w, amount) {
  w.heat = Math.min(100, w.heat + amount);
  w.coolTimer = 0;
  const stars = w.heat < 20 ? 0 : w.heat < 45 ? 1 : w.heat < 70 ? 2 : w.heat < 85 ? 3 : w.heat < 95 ? 4 : 5;
  const rose = stars > w.stars;
  w.stars = stars;
  return rose;
}

/** Heat decays when the player stays clean; stars fall with it. */
export function updateWanted(w, dt, committingCrime) {
  if (committingCrime) { w.coolTimer = 0; return; }
  w.coolTimer += dt;
  if (w.coolTimer > 6 && w.heat > 0) {
    w.heat = Math.max(0, w.heat - dt * 2.2);
    w.stars = w.heat < 20 ? 0 : w.heat < 45 ? 1 : w.heat < 70 ? 2 : w.heat < 85 ? 3 : w.heat < 95 ? 4 : 5;
  }
}

/** How many cop units the current wanted level fields. */
export function wantedCopCount(stars) {
  return [0, 1, 2, 3, 4, 6][stars] ?? 0;
}

/** Spawn a cop car on a road near (but not on top of) the player. */
export function spawnCopCar(playerPos) {
  const p = randomRoadPoint(playerPos);
  const c = makeCar(COP_TYPE, p.x, p.y, 0, { driver: 'cop' });
  c.cop = { mode: 'chase', stuckT: 0, sirenPhase: Math.random() * 2 };
  return c;
}

/** Cop car AI: chase the target, ram it, recover when stuck. */
export function updateCopCar(c, target, dt) {
  const cop = c.cop;
  if (!cop) return;
  const dx = target.x - c.x, dy = target.y - c.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - c.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const top = 500 + Math.min(60, c.type.top * 0.05);
  const accel = 360;
  if (dist > 60) c.speed += accel * dt;
  else c.speed += accel * 0.4 * dt;
  if (c.speed > top) c.speed = top;
  const grip = 3.6 * Math.min(1, Math.abs(c.speed) / 160);
  c.angle += steer * grip * dt * (c.speed >= 0 ? 1 : -1);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.brakeLight = false;
  // Stay inside the city and out of the bay.
  c.x = Math.max(30, Math.min(3200 - 30, c.x));
  c.y = Math.max(30, Math.min(2400 - 30, c.y));
  cop.sirenPhase += dt;
  // Stuck detection: if barely moving while far from target, reverse out.
  if (Math.abs(c.speed) < 20 && dist > 120) {
    cop.stuckT += dt;
    if (cop.stuckT > 1.2) { c.angle += Math.PI * 0.9; c.speed = -120; cop.stuckT = 0; }
  } else {
    cop.stuckT = 0;
  }
  return dist;
}

/** An on-foot officer: runs at the player and swings when close. */
export function makeFootCop(x, y) {
  return {
    x, y, angle: 0, speed: 165, hp: 100,
    state: 'chase', swingT: 0, hitCooldown: 0,
    shirt: '#1c2a4a', skin: '#e0ac69', bob: 0,
  };
}

export function updateFootCop(cop, target, dt) {
  cop.bob += dt * 9;
  const dx = target.x - cop.x, dy = target.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  if (dist > 26) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  }
  cop.hitCooldown -= dt;
  cop.swingT -= dt;
  if (dist < 30 && cop.hitCooldown <= 0) {
    cop.hitCooldown = 0.9;
    cop.swingT = 0.3;
    return 10; // damage dealt to the player
  }
  return 0;
}
