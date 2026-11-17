// render.js — draws the whole world: ground, roads, buildings, water, cars,
// people, particles, markers. One job: turn state into pixels.

import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_W, WATER, BEACH, DOCKS, buildings, trees, parks, districtAt } from './city.js';

const GROUND = '#7da05c';
const SIDEWALK = '#b8b0a0';

function drawBuilding(ctx, b, t) {
  // Drop shadow for height.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(b.x + 5, b.y + 5 + b.hgt * 0.35, b.w, b.h);
  // Roof.
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // Roof edge.
  ctx.strokeStyle = b.roof;
  ctx.lineWidth = 4;
  ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
  // Rooftop detail: AC units / skylights.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const n = Math.max(1, Math.floor((b.w * b.h) / 9000));
  for (let i = 0; i < n; i++) {
    const gx = b.x + 14 + ((i * 53) % Math.max(20, b.w - 28));
    const gy = b.y + 14 + ((i * 37) % Math.max(20, b.h - 28));
    ctx.fillRect(gx, gy, 16, 12);
  }
  if (b.tall) {
    // Window grid across the roof of tall towers.
    ctx.fillStyle = 'rgba(255,240,180,0.8)';
    for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 26) {
      for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 26) {
        ctx.fillRect(wx, wy, 10, 7);
      }
    }
  } else {
    // Low buildings get a lighter inner roof + a few skylights.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let wx = b.x + 16; wx < b.x + b.w - 16; wx += 34) {
      for (let wy = b.y + 16; wy < b.y + b.h - 16; wy += 34) {
        ctx.fillRect(wx, wy, 8, 6);
      }
    }
  }
}

function drawCar(ctx, c, t) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const w = c.type.w, h = c.type.h;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Body.
  ctx.fillStyle = c.type.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Hood / trunk lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 10, -h / 2 + 2); ctx.lineTo(-w / 2 + 10, h / 2 - 2);
  ctx.moveTo(w / 2 - 12, -h / 2 + 2); ctx.lineTo(w / 2 - 12, h / 2 - 2);
  ctx.stroke();
  // Cabin + windshield.
  ctx.fillStyle = '#1e2a3a';
  roundRect(ctx, -w / 6, -h / 2 + 3, w / 3, h - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,255,0.85)';
  ctx.fillRect(w / 10, -h / 2 + 4, 3, h - 8);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 8, 3, 5);
  // Brake lights.
  if (c.brakeLight) {
    ctx.fillStyle = '#ff2211';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 5);
    ctx.fillRect(-w / 2 - 1, h / 2 - 8, 3, 5);
  }
  // Taxi sign / police light bar.
  if (c.type.taxi) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -6, 8, 12);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  if (c.type.police) {
    const on = Math.floor(t * 6 + (c.cop ? c.cop.sirenPhase * 3 : 0)) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-6, -h / 2 - 2, 12, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  // Damage smoke.
  if (c.hp < 45) {
    ctx.fillStyle = `rgba(60,60,60,${0.35 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(-w / 2 + 4, 0, 6 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPed(ctx, p) {
  const bob = p.state === 'walk' ? Math.sin(p.bob) * 1.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.4);
  if (p.state === 'down') {
    // Lying flat.
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.ellipse(2, 0, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2, 5, 0, Math.PI * 2); ctx.fill();
  // Direction tick.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.angle) * 6, Math.sin(p.angle) * 6);
  ctx.lineTo(Math.cos(p.angle) * 11, Math.sin(p.angle) * 11);
  ctx.stroke();
  ctx.restore();
}

export function drawWorld(ctx, g, cam, t) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  const x0 = Math.max(0, cx - vw / 2 - 40), x1 = Math.min(WORLD_W, cx + vw / 2 + 40);
  const y0 = Math.max(0, cy - vh / 2 - 40), y1 = Math.min(WORLD_H, cy + vh / 2 + 40);

  // Ground.
  ctx.fillStyle = GROUND;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Parks.
  for (const p of parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#5d8f43';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6fae52';
    ctx.fillRect(p.x + 12, p.y + 12, p.w - 24, p.h - 24);
  }

  // Beach sand.
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(Math.max(x0, BEACH.x), BEACH.y, Math.min(x1, BEACH.x + BEACH.w) - Math.max(x0, BEACH.x), BEACH.h);
  // Beach umbrellas.
  ctx.fillStyle = '#ff6b6b';
  for (let ux = 200; ux < WORLD_W; ux += 340) {
    if (ux < x0 || ux > x1) continue;
    ctx.beginPath(); ctx.arc(ux, BEACH.y + 40, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(ux - 1, BEACH.y + 40, 2, 16);
    ctx.fillStyle = '#ff6b6b';
  }

  // Water with animated shimmer.
  for (const w of WATER) {
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(Math.max(x0, w.x), Math.max(y0, w.y), Math.min(x1, w.x + w.w) - Math.max(x0, w.x), Math.min(y1, w.y + w.h) - Math.max(y0, w.y));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let wy = w.y + 18; wy < w.y + w.h; wy += 26) {
      if (wy < y0 || wy > y1) continue;
      const off = Math.sin(t * 1.4 + wy * 0.05) * 8;
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, w.x) + 10 + off, wy);
      ctx.lineTo(Math.min(x1, w.x + w.w) - 10 + off, wy);
      ctx.stroke();
    }
  }

  // Harbor docks.
  ctx.fillStyle = '#8a6a42';
  for (const d of DOCKS) ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = '#6a4f30';
  ctx.lineWidth = 2;
  for (const d of DOCKS) {
    for (let dx = d.x + 12; dx < d.x + d.w; dx += 24) {
      ctx.beginPath(); ctx.moveTo(dx, d.y); ctx.lineTo(dx, d.y + d.h); ctx.stroke();
    }
  }

  // Roads: asphalt + center dashes + sidewalks.
  ctx.fillStyle = '#3a3f4a';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of ROAD_YS) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  // Sidewalk borders.
  ctx.fillStyle = SIDEWALK;
  for (const rx of ROAD_XS) {
    ctx.fillRect(rx - ROAD_W / 2 - 8, y0, 8, y1 - y0);
    ctx.fillRect(rx + ROAD_W / 2, y0, 8, y1 - y0);
  }
  for (const ry of ROAD_YS) {
    ctx.fillRect(x0, ry - ROAD_W / 2 - 8, x1 - x0, 8);
    ctx.fillRect(x0, ry + ROAD_W / 2, x1 - x0, 8);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d44d';
  for (const rx of ROAD_XS) {
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
  }
  for (const ry of ROAD_YS) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.5)';
  ctx.lineWidth = 4;
  for (const s of g.fx.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
    ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Buildings.
  for (const b of buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    drawBuilding(ctx, b, t);
  }

  // Trees.
  for (const tr of trees) {
    if (tr.x < x0 || tr.x > x1 || tr.y < y0 || tr.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(tr.x + 3, tr.y + 4, tr.r, tr.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f7a33';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // Pickups (mission packages / cash / SMG).
  for (const pk of g.pickups) {
    const pulse = 1 + Math.sin(t * 5 + pk.x) * 0.12;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'smg') {
      ctx.fillStyle = '#222';
      ctx.fillRect(-12, -4, 24, 8);
      ctx.fillStyle = '#ffcf4d';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMG', 0, 3);
    } else {
      ctx.fillStyle = '#ff9f1c';
      ctx.fillRect(-9, -7, 18, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, 4);
    }
    ctx.restore();
  }

  // Mission marker (world-space beacon).
  const marker = g.missionMarker;
  if (marker) {
    const bob = Math.sin(t * 3) * 6;
    ctx.save();
    ctx.translate(marker.x, marker.y - 30 + bob);
    ctx.fillStyle = '#ffcf4d';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-12, -26); ctx.lineTo(12, -26); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, -32, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcf4d';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', 0, -28);
    ctx.restore();
    // Ground ring.
    ctx.strokeStyle = 'rgba(255,207,77,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 26 + Math.sin(t * 3) * 4, 0, Math.PI * 2); ctx.stroke();
  }

  // Cars (parked + traffic + cops + player car).
  for (const c of g.cars) drawCar(ctx, c, t);
  // On-foot cops.
  for (const cop of g.footCops) drawPed(ctx, cop);
  // Pedestrians.
  for (const p of g.peds) drawPed(ctx, p);

  // Player.
  drawPlayer(ctx, g.player, g, t);

  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const b of g.combat.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
  }

  // Particles.
  for (const p of g.fx.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating texts.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of g.fx.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, pl, g, t) {
  if (pl.inCar) return;
  ctx.save();
  ctx.translate(pl.x, pl.y);
  const bob = pl.moving ? Math.sin(t * 14) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bob * 0.3);
  // Body: teal jacket.
  ctx.fillStyle = '#0e8a7b';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.arc(0, 0, 9, pl.angle - 0.9, pl.angle + 0.9); ctx.fill();
  // Head.
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath(); ctx.arc(Math.cos(pl.angle) * 2, Math.sin(pl.angle) * 2, 5.5, 0, Math.PI * 2); ctx.fill();
  // Hair.
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath(); ctx.arc(Math.cos(pl.angle) * 2 - Math.cos(pl.angle) * 2, Math.sin(pl.angle) * 2 - Math.sin(pl.angle) * 2, 5.5, pl.angle + 1.9, pl.angle + 4.4); ctx.fill();
  // Gun + muzzle flash.
  if (g.combat.muzzle > 0) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(Math.cos(pl.angle) * 20, Math.sin(pl.angle) * 20, 6 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(pl.angle) * 8, Math.sin(pl.angle) * 8);
  ctx.lineTo(Math.cos(pl.angle) * 17, Math.sin(pl.angle) * 17);
  ctx.stroke();
  ctx.restore();
}
