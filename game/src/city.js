// city.js — the city of Port Solara: roads, blocks, buildings, districts.
// Deterministic (seeded) so every player gets the same map. Pure data + queries;
// nothing here draws or updates.

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;

// Seeded RNG (mulberry32) so the city is identical every load.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20261118);

// Road center lines. Vertical roads every 400px, horizontal every 400px.
export const ROAD_XS = [];
for (let x = 240; x < WORLD_W - 100; x += 400) ROAD_XS.push(x);
export const ROAD_YS = [];
for (let y = 240; y < WORLD_H - 100; y += 400) ROAD_YS.push(y);

// Water: the bay along the south edge and the harbor on the west edge.
export const WATER = [
  { x: 0, y: 2280, w: WORLD_W, h: 120 },          // south bay / beach water
  { x: 0, y: 0, w: 110, h: WORLD_H },             // west harbor water
];
// Beach sand strip just above the south water.
export const BEACH = { x: 0, y: 2200, w: WORLD_W, h: 80 };
// Harbor docks (walkable wooden piers) on the west water.
export const DOCKS = [
  { x: 0, y: 500, w: 150, h: 60 },
  { x: 0, y: 900, w: 150, h: 60 },
  { x: 0, y: 1500, w: 150, h: 60 },
];

export function districtAt(x, y) {
  if (y >= 2200) return 'Solara Beach';
  if (x < 200) return 'Port Harbor';
  if (x >= 1200 && x < 2000 && y >= 800 && y < 1600) return 'Downtown';
  if (y < 500) return 'North Industrial';
  if (x >= 2400) return 'Barrio Sol';
  if (y >= 1600) return 'Marina District';
  return 'Old Town';
}

function districtColor(d) {
  switch (d) {
    case 'Downtown': return ['#4d5f7d', '#55688a', '#46586e', '#5d7196'];
    case 'North Industrial': return ['#6b5d4f', '#7a6a58', '#5d5348', '#84705c'];
    case 'Barrio Sol': return ['#c96f4a', '#d98a5f', '#b85a3c', '#e09a6a'];
    case 'Marina District': return ['#4a7a8a', '#55879a', '#3f6a7a', '#6a9aaa'];
    case 'Old Town': return ['#8a7a5a', '#97876a', '#7a6a4e', '#a08a6a'];
    default: return ['#5a6a7a', '#66788a', '#4e5e70'];
  }
}

// Buildings: one or two per block, kept off roads and water.
export const buildings = [];
export const trees = [];
export const parks = [];

for (let ix = 0; ix < ROAD_XS.length - 1; ix++) {
  for (let iy = 0; iy < ROAD_YS.length - 1; iy++) {
    const bx0 = ROAD_XS[ix] + ROAD_W / 2 + 14;
    const by0 = ROAD_YS[iy] + ROAD_W / 2 + 14;
    const bx1 = ROAD_XS[ix + 1] - ROAD_W / 2 - 14;
    const by1 = ROAD_YS[iy + 1] - ROAD_W / 2 - 14;
    if (by0 > 2160) continue; // beach blocks stay open
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const d = districtAt(cx, cy);
    const roll = rng();
    if (roll < 0.12) {
      // Park block: grass + trees, no building.
      parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
      const n = 4 + Math.floor(rng() * 5);
      for (let t = 0; t < n; t++) {
        trees.push({ x: bx0 + 20 + rng() * (bx1 - bx0 - 40), y: by0 + 20 + rng() * (by1 - by0 - 40), r: 10 + rng() * 8 });
      }
      continue;
    }
    const palette = districtColor(d);
    const tall = d === 'Downtown';
    const two = rng() < 0.45 && !tall;
    const mk = (x, y, w, h) => ({
      x, y, w, h,
      color: palette[Math.floor(rng() * palette.length)],
      roof: tall ? '#2c3550' : '#33302a',
      tall,
      hgt: tall ? 26 + Math.floor(rng() * 30) : 6 + Math.floor(rng() * 8),
      district: d,
    });
    if (two) {
      const splitV = rng() < 0.5;
      if (splitV) {
        const mid = bx0 + (bx1 - bx0) * (0.42 + rng() * 0.16);
        buildings.push(mk(bx0, by0, mid - bx0 - 10, by1 - by0));
        buildings.push(mk(mid + 10, by0, bx1 - mid - 10, by1 - by0));
      } else {
        const mid = by0 + (by1 - by0) * (0.42 + rng() * 0.16);
        buildings.push(mk(bx0, by0, bx1 - bx0, mid - by0 - 10));
        buildings.push(mk(bx0, mid + 10, bx1 - bx0, by1 - mid - 10));
      }
    } else {
      buildings.push(mk(bx0, by0, bx1 - bx0, by1 - by0));
    }
    // A few street trees on block corners.
    if (rng() < 0.6) trees.push({ x: bx0 + 6, y: by0 + 6, r: 9 });
    if (rng() < 0.4) trees.push({ x: bx1 - 6, y: by1 - 6, r: 9 });
  }
}

// Landmark locations (all on road intersections, docks, or the beach road).
export const LANDMARKS = {
  marlinClub: { x: 1440, y: 1040, name: 'The Marlin Club' },
  garage: { x: 2640, y: 640, name: "Vic's Garage" },
  bank: { x: 1840, y: 1040, name: 'Solara National Bank' },
  hideout: { x: 2640, y: 1840, name: 'Hideout — Safehouse' },
  hospital: { x: 640, y: 1840, name: 'St. Marina Hospital' },
  carLot: { x: 640, y: 640, name: 'Sunset Auto Lot' },
  pier: { x: 160, y: 900, name: 'Harbor Pier' },
  beachBar: { x: 1200, y: 2240, name: 'Tide & Lime Bar' },
};
export const PLAYER_SPAWN = { x: 1440, y: 1360 };

// --- Queries ---------------------------------------------------------------

export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function inWater(x, y) {
  for (const w of WATER) if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
  return false;
}

export function onDock(x, y) {
  for (const d of DOCKS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return true;
  return false;
}

/** Nearest point on a road center line to (x, y) — used by traffic AI. */
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const rx of ROAD_XS) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

/** Circle vs building collision. Returns the building hit, or null. */
export function buildingHit(x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Resolve a circle out of buildings: push it to the nearest free edge. */
export function resolveBuildingCollision(e, r) {
  const b = buildingHit(e.x, e.y, r);
  if (!b) return false;
  const pushL = (e.x + r) - b.x;
  const pushR = (b.x + b.w) - (e.x - r);
  const pushT = (e.y + r) - b.y;
  const pushB = (b.y + b.h) - (e.y - r);
  const m = Math.min(pushL, pushR, pushT, pushB);
  if (m === pushL) e.x = b.x - r;
  else if (m === pushR) e.x = b.x + b.w + r;
  else if (m === pushT) e.y = b.y - r;
  else e.y = b.y + b.h + r;
  return true;
}

export function clampToWorld(e, margin) {
  e.x = Math.max(margin, Math.min(WORLD_W - margin, e.x));
  e.y = Math.max(margin, Math.min(WORLD_H - margin, e.y));
}

/** A random drivable point on a road, away from the given spot. */
export function randomRoadPoint(minDistFrom) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng() < 0.5;
    const p = vertical
      ? { x: ROAD_XS[Math.floor(rng() * ROAD_XS.length)], y: 200 + rng() * (WORLD_H - 400) }
      : { x: 200 + rng() * (WORLD_W - 400), y: ROAD_YS[Math.floor(rng() * ROAD_YS.length)] };
    if (!minDistFrom || Math.hypot(p.x - minDistFrom.x, p.y - minDistFrom.y) > 500) return p;
  }
  return { x: 1600, y: 1200 };
}
