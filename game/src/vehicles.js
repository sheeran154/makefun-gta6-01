// vehicles.js — cars: definitions, player driving physics, traffic AI.
// One job: everything with four wheels.

import { ROAD_XS, ROAD_YS, ROAD_W, WORLD_W, WORLD_H, buildingHit, nearestRoadPoint, randomRoadPoint, onRoad, makeRng, inWater, onDock } from './city.js';

const rng = makeRng(777);

export const CAR_TYPES = [
  { name: 'Comet', color: '#e33f2f', w: 46, h: 22, accel: 340, top: 520, grip: 3.4 },
  { name: 'Sedan', color: '#3f7ad9', w: 48, h: 22, accel: 280, top: 430, grip: 3.0 },
  { name: 'Taxi', color: '#f2c230', w: 48, h: 22, accel: 270, top: 420, grip: 3.0, taxi: true },
  { name: 'Pickup', color: '#7a8a3f', w: 52, h: 24, accel: 250, top: 400, grip: 2.8 },
  { name: 'Van', color: '#c8c8c8', w: 54, h: 26, accel: 220, top: 360, grip: 2.6 },
  { name: 'Sports', color: '#9b2fd9', w: 46, h: 21, accel: 380, top: 580, grip: 3.8 },
  { name: 'Muscle', color: '#e07b1f', w: 50, h: 23, accel: 320, top: 470, grip: 3.1 },
  { name: 'Cop Cruiser', color: '#222831', w: 48, h: 22, accel: 330, top: 540, grip: 3.6, police: true },
];

export function makeCar(type, x, y, angle, opts = {}) {
  return {
    type,
    x, y, angle, speed: 0,
    driver: opts.driver ?? null,      // 'traffic' | 'player' | 'cop' | null (parked)
    stolen: false,
    hp: 100,
    smoke: 0,
    brakeLight: false,
    steerVis: 0,
    id: opts.id ?? Math.floor(rng() * 1e9),
    // traffic AI state
    ai: opts.driver === 'traffic' ? {
      dir: Math.floor(rng() * 4),       // 0 E, 1 S, 2 W, 3 N
      vertical: rng() < 0.5,
      lane: (rng() < 0.5 ? -1 : 1) * (ROAD_W / 4),
      speed: 120 + rng() * 70,
      wait: 0,
    } : null,
    // cop AI state
    cop: null,
  };
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/** Move a car forward along its heading by its speed. Cars stay inside the
 *  world and out of the water (no driving into the bay). */
export function integrateCar(c, dt) {
  const px = c.x, py = c.y;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  if (inWater(c.x, c.y) && !onDock(c.x, c.y)) { c.x = px; c.y = py; c.speed *= 0.3; return; }
  c.x = Math.max(30, Math.min(WORLD_W - 30, c.x));
  c.y = Math.max(30, Math.min(WORLD_H - 30, c.y));
}

/** Player driving: arcade handling with drift and a handbrake. */
export function drivePlayerCar(c, input, dt) {
  const t = c.type;
  const forward = input.up ? 1 : input.down ? -0.55 : 0;
  const target = forward * t.top;
  const rate = forward > 0 ? t.accel : t.accel * 0.8;
  if (forward !== 0) {
    c.speed += Math.sign(target - c.speed) * rate * dt;
    if (forward > 0 && c.speed > t.top) c.speed = t.top;
    if (forward < 0 && c.speed < target) c.speed = target;
  } else {
    c.speed -= c.speed * 1.6 * dt;
    if (Math.abs(c.speed) < 4) c.speed = 0;
  }
  if (input.brake) { // handbrake: kill speed, loosen grip
    c.speed -= c.speed * 3.2 * dt;
  }
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = input.brake ? t.grip * 0.45 : t.grip;
  const dirSign = c.speed >= 0 ? 1 : -1;
  c.angle += steer * grip * Math.min(1, Math.abs(c.speed) / 160) * dirSign * dt;
  c.steerVis = steer;
  c.brakeLight = input.down || input.brake;
  integrateCar(c, dt);
  return Math.abs(c.speed) > 240 && steer !== 0; // skidding?
}

/** Traffic: follow the road grid, turn at intersections, stop for cars ahead. */
export function updateTrafficCar(c, dt, cars) {
  const ai = c.ai;
  if (!ai) return;
  if (ai.wait > 0) { ai.wait -= dt; c.speed = 0; return; }
  const [dx, dy] = DIRS[ai.dir];
  const nearIntersection =
    (ai.vertical && ROAD_YS.some((y) => Math.abs(c.y - y) < 14)) ||
    (!ai.vertical && ROAD_XS.some((x) => Math.abs(c.x - x) < 14));
  if (nearIntersection && rng() < dt * 0.9) {
    // Pick a new direction at the junction (never reverse).
    const options = [0, 1, 2, 3].filter((d) => d !== (ai.dir + 2) % 4);
    ai.dir = options[Math.floor(rng() * options.length)];
    ai.vertical = ai.dir === 1 || ai.dir === 3;
  }
  // Stay in lane: gently steer toward the lane center line.
  const laneX = ai.vertical ? c.x : null;
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - c.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  c.angle += diff * Math.min(1, 4 * dt);
  // Car ahead? slow down.
  const ahead = cars.some((o) => o !== c && o.speed >= 0 &&
    Math.hypot(o.x - c.x, o.y - c.y) < 70 &&
    Math.abs(Math.atan2(o.y - c.y, o.x - c.x) - c.angle) < 0.6);
  const want = ahead ? 0 : ai.speed;
  c.speed += (want - c.speed) * Math.min(1, 2.5 * dt);
  integrateCar(c, dt);
  // Nudge back onto the road if drifting off-grid.
  if (!onRoad(c.x, c.y)) {
    const p = nearestRoadPoint(c.x, c.y);
    c.x += (p.x - c.x) * 0.5 * dt;
    c.y += (p.y - c.y) * 0.5 * dt;
  }
  if (buildingHit(c.x, c.y, 20)) { c.speed = 0; ai.dir = (ai.dir + 2) % 4; ai.vertical = !ai.vertical; }
}

/** Spawn a parked car on a roadside spot near a point. */
export function spawnParkedCar(near) {
  const p = randomRoadPoint(near);
  const vertical = rng() < 0.5;
  const type = CAR_TYPES[Math.floor(rng() * (CAR_TYPES.length - 1))]; // never a cop car parked
  const off = (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 12);
  const x = vertical ? p.x + off : p.x;
  const y = vertical ? p.y : p.y + off;
  const angle = vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI);
  return makeCar(type, x, y, angle, { driver: null });
}

/** Spawn a traffic car on a road, far from the player. */
export function spawnTrafficCar(playerPos) {
  const p = randomRoadPoint(playerPos);
  const type = CAR_TYPES[Math.floor(rng() * (CAR_TYPES.length - 1))];
  const vertical = rng() < 0.5;
  const dir = vertical ? (rng() < 0.5 ? 1 : 3) : (rng() < 0.5 ? 0 : 2);
  const lane = (rng() < 0.5 ? -1 : 1) * (ROAD_W / 4);
  const c = makeCar(type, vertical ? p.x + lane : p.x, vertical ? p.y : p.y + lane,
    Math.atan2(DIRS[dir][1], DIRS[dir][0]), { driver: 'traffic' });
  c.ai.dir = dir;
  c.ai.vertical = vertical;
  return c;
}
