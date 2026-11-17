// pedestrians.js — people walking the sidewalks of Port Solara.
// One job: pedestrians who stroll, flee gunfire, and react to the player.

import { onRoad, randomRoadPoint, makeRng, buildingHit, clampToWorld } from './city.js';

const rng = makeRng(4242);

const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(x, y) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 28 + rng() * 26,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    state: 'walk',          // walk | flee | down
    stateT: 0,
    target: randomRoadPoint(null),
    hp: 100,
    bob: rng() * 10,
  };
}

export function spawnPed(playerPos) {
  const p = randomRoadPoint(playerPos);
  return makePed(p.x, p.y);
}

/** A pedestrian flees from a scary point (gunshot / speeding car). */
export function scarePeds(peds, x, y, radius) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) {
      p.state = 'flee';
      p.stateT = 2.5 + rng() * 2;
      p.angle = Math.atan2(p.y - y, p.x - x);
      p.speed = 150 + rng() * 60;
    }
  }
}

export function updatePed(p, dt) {
  p.bob += dt * 8;
  if (p.state === 'down') return;
  if (p.state === 'flee') {
    p.stateT -= dt;
    if (p.stateT <= 0) { p.state = 'walk'; p.speed = 28 + rng() * 26; }
  } else {
    // Walk toward the current target; pick a new one on arrival.
    const d = Math.hypot(p.target.x - p.x, p.target.y - p.y);
    if (d < 30) p.target = randomRoadPoint(null);
    const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += diff * Math.min(1, 3 * dt);
  }
  const nx = p.x + Math.cos(p.angle) * p.speed * dt;
  const ny = p.y + Math.sin(p.angle) * p.speed * dt;
  if (!buildingHit(nx, ny, 10)) { p.x = nx; p.y = ny; }
  clampToWorld(p, 20);
}
