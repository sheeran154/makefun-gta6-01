// hud.js — HUD, minimap, and all menus (start, pause, phone, busted).
// One job: everything the player reads on screen.

import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, buildings } from './city.js';
import { MISSIONS, currentMission, missionObjectiveText, missionsComplete } from './missions.js';

const MM = 190; // minimap size
const MM_SCALE = MM / WORLD_W;

function drawStars(ctx, stars, x, y) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffcf4d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 28, y);
  }
}

export function drawMinimap(ctx, g, canvasW, canvasH) {
  const mx = canvasW - MM - 16, my = canvasH - MM - 16;
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,24,0.85)';
  ctx.fillRect(mx - 6, my - 6, MM + 12, MM + 12);
  ctx.strokeStyle = '#ffcf4d';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx - 6, my - 6, MM + 12, MM + 12);
  ctx.beginPath();
  ctx.rect(mx, my, MM, MM);
  ctx.clip();
  // Water + ground.
  ctx.fillStyle = '#1d3a4a';
  ctx.fillRect(mx, my, MM, MM);
  ctx.fillStyle = '#2c4a3a';
  ctx.fillRect(mx, my, MM, MM * (WORLD_H / WORLD_W) * 0 + MM * 0.92);
  // Roads.
  ctx.strokeStyle = '#8a8f98';
  ctx.lineWidth = 2;
  for (const rx of ROAD_XS) {
    ctx.beginPath(); ctx.moveTo(mx + rx * MM_SCALE, my); ctx.lineTo(mx + rx * MM_SCALE, my + MM); ctx.stroke();
  }
  for (const ry of ROAD_YS) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * MM_SCALE); ctx.lineTo(mx + MM, my + ry * MM_SCALE); ctx.stroke();
  }
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (const b of buildings) {
    ctx.fillRect(mx + b.x * MM_SCALE, my + b.y * MM_SCALE, Math.max(1, b.w * MM_SCALE), Math.max(1, b.h * MM_SCALE));
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * MM_SCALE, my + y * MM_SCALE, r, 0, Math.PI * 2); ctx.fill();
  };
  // Mission marker.
  if (g.missionMarker) {
    const pulse = 4 + Math.sin(g.time * 5) * 1.5;
    dot(g.missionMarker.x, g.missionMarker.y, '#ffcf4d', pulse);
    ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + g.missionMarker.x * MM_SCALE, my + g.missionMarker.y * MM_SCALE, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Cops.
  for (const c of g.cars) if (c.driver === 'cop') dot(c.x, c.y, '#3f8cff', 3);
  for (const cop of g.footCops) dot(cop.x, cop.y, '#3f8cff', 3);
  // Player arrow.
  const px = mx + g.player.x * MM_SCALE, py = my + g.player.y * MM_SCALE;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Label.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLARA', mx, my - 10);
}

export function drawHud(ctx, g, canvasW, canvasH) {
  // Cash.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#2fae4e';
  ctx.fillText(`$${g.cash.toLocaleString('en-US')}`, 18, 36);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(g.district, 18, 58);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(18, 66, 170, 14);
  ctx.fillStyle = g.player.hp > 40 ? '#2fae4e' : '#e33f2f';
  ctx.fillRect(20, 68, 166 * Math.max(0, g.player.hp / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`HP ${Math.ceil(g.player.hp)}`, 24, 77);
  // Wanted stars, top right.
  drawStars(ctx, g.wanted.stars, canvasW - 170, 38);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(g.wanted.stars > 0 ? 'SOLARA PD IS AFTER YOU' : 'CLEAN', canvasW - 18, 58);
  // Weapon.
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(g.combat.weapon === 'smg' ? `SMG  ${Math.ceil(g.combat.smgTimer)}s` : 'PISTOL ∞', canvasW - 18, 84);
  // Objective banner, top center.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  const obj = missionObjectiveText(g.ms);
  const w = ctx.measureText(obj).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(canvasW / 2 - w / 2, 12, w, 30);
  ctx.fillStyle = '#ffcf4d';
  ctx.fillText(obj, canvasW / 2, 32);
  // Mission banner (big center text, fades).
  if (g.ms.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, g.ms.bannerT);
    ctx.font = 'bold 22px sans-serif';
    const lines = wrapText(ctx, g.ms.banner, canvasW - 200);
    const bh = lines.length * 28 + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(canvasW / 2 - (canvasW - 160) / 2, canvasH * 0.22, canvasW - 160, bh);
    ctx.fillStyle = '#fff';
    lines.forEach((ln, i) => ctx.fillText(ln, canvasW / 2, canvasH * 0.22 + 34 + i * 28));
    ctx.globalAlpha = 1;
  }
  // Context prompt ("E — Enter car", etc.).
  if (g.prompt) {
    ctx.font = 'bold 16px sans-serif';
    const pw = ctx.measureText(g.prompt).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvasW / 2 - pw / 2, canvasH - 96, pw, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(g.prompt, canvasW / 2, canvasH - 74);
  }
  // Controls reminder, bottom left.
  ctx.textAlign = 'left';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('WASD move/drive · E car · Click shoot · SPACE handbrake · M missions · ESC pause', 18, canvasH - 18);
  drawMinimap(ctx, g, canvasW, canvasH);
  // Crosshair.
  if (!g.player.inCar) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    const mx = g.mouse.x, my = g.mouse.y;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
    ctx.stroke();
  }
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawStartScreen(ctx, g, canvasW, canvasH, hasSave) {
  // Sun-soaked gradient sky + skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#ff5e62');
  grad.addColorStop(1, '#2a1a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(canvasW * 0.78, 130, 55, 0, Math.PI * 2); ctx.fill();
  // Skyline.
  ctx.fillStyle = 'rgba(20,10,40,0.85)';
  const skyline = [120, 200, 150, 260, 180, 230, 300, 160, 210, 240, 140, 190];
  let sx = 0;
  for (const h of skyline) {
    ctx.fillRect(sx, canvasH - 260 - h, 110, h + 260);
    sx += 108;
  }
  // Palm silhouettes.
  ctx.strokeStyle = 'rgba(20,10,40,0.9)';
  ctx.lineWidth = 6;
  for (const px of [120, canvasW - 160]) {
    ctx.beginPath(); ctx.moveTo(px, canvasH - 60); ctx.quadraticCurveTo(px + 20, canvasH - 180, px + 60, canvasH - 210); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
  ctx.fillText('PORT SOLARA', canvasW / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#ffcf4d';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', canvasW / 2, 232);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Jace Moreno is back in town — and the Marlin Club owns his debt.', canvasW / 2, 268);
  ctx.fillText('Steal cars. Outrun the Solara PD. Run six jobs. Take back the city.', canvasW / 2, 292);
  // Buttons.
  const bw = 320, bh = 54;
  const buttons = hasSave
    ? [{ label: 'CONTINUE', y: 360 }, { label: 'NEW GAME', y: 428 }]
    : [{ label: 'START GAME', y: 360 }];
  g.menuButtons = buttons.map((b) => ({ ...b, x: canvasW / 2 - bw / 2, w: bw, h: bh }));
  for (const b of g.menuButtons) {
    const hover = g.mouse.x >= b.x && g.mouse.x <= b.x + b.w && g.mouse.y >= b.y && g.mouse.y <= b.y + b.h;
    ctx.fillStyle = hover ? '#ffcf4d' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = hover ? '#111' : '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(b.label, canvasW / 2, b.y + 36);
  }
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD move / drive · E enter car · Mouse aim · Click shoot · M missions · ESC pause', canvasW / 2, 540);
  ctx.fillText('A 100% original game. No real-world brands, no borrowed art, music or names.', canvasW / 2, 566);
  ctx.fillText('Sound is synthesized live with WebAudio — no audio files.', canvasW / 2, 590);
}

export function drawPauseScreen(ctx, g, canvasW, canvasH) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', canvasW / 2, 200);
  const bw = 320, bh = 50;
  const buttons = [
    { label: 'RESUME', y: 280, id: 'resume' },
    { label: 'SAVE GAME', y: 344, id: 'save' },
    { label: 'QUIT TO MENU', y: 408, id: 'quit' },
  ];
  g.menuButtons = buttons.map((b) => ({ ...b, x: canvasW / 2 - bw / 2, w: bw, h: bh }));
  for (const b of g.menuButtons) {
    const hover = g.mouse.x >= b.x && g.mouse.x <= b.x + b.w && g.mouse.y >= b.y && g.mouse.y <= b.y + b.h;
    ctx.fillStyle = hover ? '#ffcf4d' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = hover ? '#111' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(b.label, canvasW / 2, b.y + 33);
  }
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(g.saveMessage ?? '', canvasW / 2, 490);
  ctx.fillText(`Cash $${g.cash.toLocaleString('en-US')} · Missions complete: ${g.missionsDone} / ${MISSIONS.length}`, canvasW / 2, 520);
}

export function drawPhoneScreen(ctx, g, canvasW, canvasH) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  const pw = 560, ph = 560;
  const px = canvasW / 2 - pw / 2, py = canvasH / 2 - ph / 2;
  ctx.fillStyle = '#101826';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = 3;
  ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffcf4d';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('JAY’S PHONE — JOBS', px + 24, py + 44);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  let y = py + 84;
  MISSIONS.forEach((m, i) => {
    const done = i < g.missionsDone;
    const current = i === g.ms.index && !missionsComplete(g.ms);
    ctx.fillStyle = done ? '#2fae4e' : current ? '#ffcf4d' : 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`${done ? '✓' : current ? '►' : '·'}  ${i + 1}. ${m.title} — $${m.reward}`, px + 24, y);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px sans-serif';
    ctx.fillText(m.brief, px + 44, y + 22);
    y += 52;
  });
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`Cash: $${g.cash.toLocaleString('en-US')}    Wanted: ${'★'.repeat(g.wanted.stars)}${'☆'.repeat(5 - g.wanted.stars)}`, px + 24, py + ph - 56);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Press M or ESC to close. Press ENTER to start the next job.', px + 24, py + ph - 28);
}

export function drawEndScreen(ctx, g, canvasW, canvasH, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.85)' : 'rgba(20,0,0,0.85)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#7db4ff' : '#ff6b6b';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', canvasW / 2, canvasH / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The Solara PD hauled you in. You lost some cash — but the city is still yours.'
    : 'You went down hard. St. Marina patched you up — for a fee.', canvasW / 2, canvasH / 2 + 10);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Press ENTER to get back out there.', canvasW / 2, canvasH / 2 + 60);
}
