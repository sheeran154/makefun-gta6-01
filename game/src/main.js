// main.js — PORT SOLARA: game loop, player, camera, missions, wanted, saves.
// One job: wire every system together and run the game.

import { initInput, keys, mouse, consume, consumeClick } from './input.js';
import {
  WORLD_W, WORLD_H, LANDMARKS, PLAYER_SPAWN, buildings, districtAt,
  buildingHit, resolveBuildingCollision, clampToWorld, randomRoadPoint, inWater, onDock,
} from './city.js';
import { CAR_TYPES, makeCar, drivePlayerCar, updateTrafficCar, spawnParkedCar, spawnTrafficCar } from './vehicles.js';
import { makePed, spawnPed, updatePed, scarePeds } from './pedestrians.js';
import { makeWanted, addHeat, updateWanted, wantedCopCount, spawnCopCar, updateCopCar, makeFootCop, updateFootCop } from './police.js';
import { makeCombat, tryFire, updateBullets, grantSmg } from './combat.js';
import { makeEffects, spawnParticles, spawnExplosion, addSkid, addFloat, updateEffects } from './effects.js';
import {
  MISSIONS, makeMissionState, currentMission, missionsComplete,
  missionMarker, missionObjectiveText, startMission, completeMission, failMission,
} from './missions.js';
import { saveGame, loadGame, hasSave } from './save.js';
import {
  makeAudio, startAudio, updateMusic, setEngine, setSiren,
  sfxGunshot, sfxPickup, sfxCash, sfxExplosion, sfxHorn, sfxPunch, sfxClick, sfxMission, sfxFail,
} from './audio.js';
import { drawWorld } from './render.js';
import { drawHud, drawStartScreen, drawPauseScreen, drawPhoneScreen, drawEndScreen } from './hud.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
initInput(canvas);

const audio = makeAudio();

const g = {
  state: 'menu', // menu | playing | paused | phone | busted | wasted
  time: 0,
  cash: 200,
  missionsDone: 0,
  ms: makeMissionState(0),
  player: null,
  cars: [],
  peds: [],
  footCops: [],
  pickups: [],
  combat: makeCombat(),
  wanted: makeWanted(),
  fx: makeEffects(),
  camera: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, w: 1280, h: 800 },
  missionMarker: null,
  prompt: null,
  district: 'Downtown',
  saveMessage: '',
  menuButtons: [],
  mouse,
  endKind: null,
  endTimer: 0,
  crimeThisFrame: false,
  heistHold: 0,
  trafficTimer: 0,
  cashTimer: 0,
};

function newPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: 100,
    inCar: false, car: null, moving: false, speed: 0,
  };
}

function resetWorld(save) {
  g.cash = save ? save.cash : 200;
  g.missionsDone = save ? save.missionsDone : 0;
  g.ms = makeMissionState(g.missionsDone);
  const px = save ? save.player.x : PLAYER_SPAWN.x;
  const py = save ? save.player.y : PLAYER_SPAWN.y;
  g.player = newPlayer(px, py);
  if (save) g.player.hp = save.player.hp;
  g.cars = [];
  g.peds = [];
  g.footCops = [];
  g.pickups = [];
  g.combat = makeCombat();
  g.wanted = makeWanted();
  g.fx = makeEffects();
  g.camera.x = px; g.camera.y = py;
  g.endKind = null;
  g.heistHold = 0;
  // Starter car parked near spawn so the player can drive right away.
  // On the vertical road x=1440, facing south along it.
  const starter = makeCar(CAR_TYPES[1], px, py + 280, Math.PI / 2, { driver: null });
  g.cars.push(starter);
  for (let i = 0; i < 12; i++) g.cars.push(spawnParkedCar(g.player));
  for (let i = 0; i < 18; i++) g.cars.push(spawnTrafficCar(g.player));
  for (let i = 0; i < 36; i++) g.peds.push(spawnPed(g.player));
  for (let i = 0; i < 6; i++) spawnCashPickup();
  // The Comet for the Hot Wheels mission, parked at the auto lot.
  const comet = makeCar(CAR_TYPES[0], LANDMARKS.carLot.x + 30, LANDMARKS.carLot.y + 20, Math.PI / 2, { driver: null });
  comet.missionCar = true;
  g.cars.push(comet);
}

function spawnCashPickup() {
  const p = randomRoadPoint(g.player);
  g.pickups.push({ x: p.x, y: p.y, kind: 'cash', value: 25 + Math.floor(Math.random() * 50) });
}

function spawnSmgPickup() {
  const p = randomRoadPoint(g.player);
  g.pickups.push({ x: p.x, y: p.y, kind: 'smg' });
}

// --- Test / debug hook (read-only state for the maker's own play-tests). ---
window.__game = {
  get state() { return g.state; },
  get player() { return g.player; },
  get cash() { return g.cash; },
  get wanted() { return g.wanted; },
  get ms() { return g.ms; },
  get missionsDone() { return g.missionsDone; },
  get cars() { return g.cars; },
  get peds() { return g.peds; },
  get missionMarker() { return g.missionMarker; },
  get prompt() { return g.prompt; },
  get saveMessage() { return g.saveMessage; },
  startGame: () => { resetWorld(null); g.state = 'playing'; },
  startMission: () => startMission(g.ms),
};

// --- Helpers ---------------------------------------------------------------

function nearestCar(x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of g.cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function commitCrime(amount) {
  g.crimeThisFrame = true;
  const rose = addHeat(g.wanted, amount);
  if (rose && g.wanted.stars >= 3) sfxHorn(audio);
  return rose;
}

function damageCar(c, amount, byPlayer) {
  c.hp -= amount;
  if (c.hp <= 0 && !c.dead) {
    c.dead = true;
    spawnExplosion(g.fx, c.x, c.y);
    sfxExplosion(audio);
    scarePeds(g.peds, c.x, c.y, 300);
    if (byPlayer) commitCrime(10);
    if (c.missionCar && g.ms.phase === 'active' && currentMission(g.ms)?.kind === 'steal-deliver') {
      failMission(g.ms, 'The Comet was destroyed!');
      sfxFail(audio);
    }
    if (c.driver === 'viper') {
      awardMission();
    }
  }
}


/** Pay out a completed mission: cash, mission count, sound, autosave. */
function awardMission() {
  const reward = completeMission(g.ms);
  g.cash += reward;
  g.missionsDone = g.ms.index;
  sfxMission(audio);
  saveGame(g);
}

function explodeCarCheck(c) {
  if (c.hp <= 0 && !c.dead) damageCar(c, 0, false);
}

// --- Player: on foot -------------------------------------------------------

function updatePlayerOnFoot(dt) {
  const p = g.player;
  const run = keys.run ? 1.7 : 1;
  const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (len > 0) {
    const speed = 175 * run;
    p.x += (dx / len) * speed * dt;
    p.y += (dy / len) * speed * dt;
    p.speed = speed;
    // Aim follows movement when not shooting; mouse aim when aiming.
    p.angle = Math.atan2(
      (g.mouse.y + g.camera.y - g.camera.h / 2) - p.y,
      (g.mouse.x + g.camera.x - g.camera.w / 2) - p.x,
    );
  } else {
    p.speed = 0;
    p.angle = Math.atan2(
      (g.mouse.y + g.camera.y - g.camera.h / 2) - p.y,
      (g.mouse.x + g.camera.x - g.camera.w / 2) - p.x,
    );
  }
  resolveBuildingCollision(p, 11);
  if (inWater(p.x, p.y) && !onDock(p.x, p.y)) {
    // Can't swim: push back out of the water.
    p.y = p.y > WORLD_H - 130 ? WORLD_H - 130 : p.y;
    p.x = p.x < 130 ? 130 : p.x;
  }
  clampToWorld(p, 16);

  // Shooting.
  if (mouse.down) {
    if (tryFire(g.combat, p.x, p.y, p.angle, dt)) {
      sfxGunshot(audio);
      scarePeds(g.peds, p.x, p.y, 260);
      commitCrime(4);
    }
  } else {
    g.combat.fireCooldown -= dt;
    g.combat.muzzle = Math.max(0, g.combat.muzzle - dt * 4);
  }

  // Enter a car.
  if (consume('enter')) {
    const c = nearestCar(p.x, p.y, 70);
    if (c) {
      enterCar(c);
    } else if (tryMissionInteract()) {
      // handled inside
    } else {
      sfxClick(audio);
    }
  }

  // Pickups.
  for (const pk of g.pickups) {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        g.cash += pk.value;
        addFloat(g.fx, p.x, p.y - 20, `+$${pk.value}`, '#2fae4e');
        sfxCash(audio);
      } else if (pk.kind === 'smg') {
        grantSmg(g.combat, 25);
        addFloat(g.fx, p.x, p.y - 20, 'SMG!', '#ffcf4d');
        sfxPickup(audio);
      } else if (pk.kind === 'package') {
        g.ms.collected++;
        sfxPickup(audio);
        addFloat(g.fx, p.x, p.y - 20, `Package ${g.ms.collected}/3`, '#ff9f1c');
        if (g.ms.collected >= 3) { g.ms.stage = 1; }
      }
    }
  }
  g.pickups = g.pickups.filter((pk) => !pk.taken);
}

function enterCar(c) {
  const p = g.player;
  if (c.driver === 'traffic') {
    // Steal it: the driver flees on foot.
    const driver = makePed(c.x + 20, c.y);
    driver.state = 'flee';
    driver.stateT = 4;
    driver.angle = Math.atan2(driver.y - p.y, driver.x - p.x);
    g.peds.push(driver);
    commitCrime(20);
    addFloat(g.fx, c.x, c.y - 30, 'CAR STOLEN!', '#ff6b6b');
    sfxHorn(audio);
  } else if (c.driver === 'cop') {
    commitCrime(30);
    addFloat(g.fx, c.x, c.y - 30, 'COP CAR STOLEN!', '#ff6b6b');
  }
  c.driver = 'player';
  c.stolen = true;
  c.hp = Math.max(c.hp, 150);
  p.inCar = true;
  p.car = c;
  p.x = c.x; p.y = c.y;
  sfxClick(audio);
}

function exitCar() {
  const p = g.player;
  const c = p.car;
  if (!c) return;
  c.driver = null;
  c.speed = 0;
  p.inCar = false;
  p.car = null;
  p.x = c.x + Math.cos(c.angle + Math.PI / 2) * 40;
  p.y = c.y + Math.sin(c.angle + Math.PI / 2) * 40;
  resolveBuildingCollision(p, 11);
  clampToWorld(p, 16);
  sfxClick(audio);
}

// --- Player: driving ---------------------------------------------------------

function updatePlayerCar(dt) {
  const p = g.player;
  const c = p.car;
  const skidding = drivePlayerCar(c, keys, dt);
  p.x = c.x; p.y = c.y;
  p.angle = c.angle;
  p.speed = c.speed;
  if (skidding) {
    addSkid(g.fx, c.x - Math.cos(c.angle) * 20, c.y - Math.sin(c.angle) * 20, c.angle);
    if (Math.random() < dt * 20) spawnParticles(g.fx, c.x, c.y, { n: 1, speed: 40, life: 0.3, size: 3, color: '#cccccc' });
  }
  // Building collision: stop + damage.
  if (buildingHit(c.x, c.y, 20)) {
    resolveBuildingCollision(c, 20);
    if (Math.abs(c.speed) > 200) {
      damageCar(c, 8, false);
      spawnParticles(g.fx, c.x, c.y, { n: 8, speed: 150, life: 0.4, size: 4, color: '#ffd166' });
      sfxPunch(audio);
    }
    c.speed *= -0.25;
  }
  // Car vs car.
  for (const o of g.cars) {
    if (o === c || o.dead) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const nx = (o.x - c.x) / d, ny = (o.y - c.y) / d;
      o.x += nx * push; o.y += ny * push;
      c.x -= nx * push; c.y -= ny * push;
      const impact = Math.abs(c.speed) + Math.abs(o.speed);
      if (impact > 180) {
        damageCar(o, 8, true);
        damageCar(c, 5, false);
        spawnParticles(g.fx, (c.x + o.x) / 2, (c.y + o.y) / 2, { n: 10, speed: 180, life: 0.4, size: 4, color: '#ffd166' });
        if (o.driver === 'cop') commitCrime(12);
        else if (o.driver === 'viper') damageCar(o, 14, true);
        sfxPunch(audio);
      }
      c.speed *= 0.6;
      o.speed *= 0.5;
    }
  }
  // Running over pedestrians.
  for (const ped of g.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - c.x, ped.y - c.y) < 30 && Math.abs(c.speed) > 60) {
      ped.state = 'down';
      ped.hp = 0;
      commitCrime(15);
      addFloat(g.fx, ped.x, ped.y - 20, 'PED DOWN!', '#ff6b6b');
      scarePeds(g.peds, ped.x, ped.y, 220);
      sfxPunch(audio);
    }
  }
  // Pickups while driving.
  for (const pk of g.pickups) {
    if (pk.kind === 'cash' && Math.hypot(pk.x - c.x, pk.y - c.y) < 36) {
      pk.taken = true;
      g.cash += pk.value;
      addFloat(g.fx, c.x, c.y - 26, `+$${pk.value}`, '#2fae4e');
      sfxCash(audio);
    }
  }
  g.pickups = g.pickups.filter((pk) => !pk.taken);

  if (consume('enter')) exitCar();
  if (Math.abs(c.speed) > 320 && Math.random() < dt * 0.5) commitCrime(1);
}

// --- Missions ----------------------------------------------------------------

function tryMissionInteract() {
  const m = currentMission(g.ms);
  const p = g.player;
  if (!m || g.ms.phase !== 'active') return false;
  if (m.kind === 'welcome') {
    if (Math.hypot(p.x - LANDMARKS.marlinClub.x, p.y - LANDMARKS.marlinClub.y) < 80) {
      awardMission();
      return true;
    }
  }
  if (m.kind === 'heist' && g.ms.stage === 0 && !p.inCar) {
    if (Math.hypot(p.x - LANDMARKS.bank.x, p.y - LANDMARKS.bank.y) < 80) {
      g.ms.stage = 1;
      g.cash += 800;
      commitCrime(60);
      g.ms.banner = 'CASH GRABBED! Now lose the heat — get to the hideout!';
      g.ms.bannerT = 4;
      sfxCash(audio);
      return true;
    }
  }
  return false;
}

function updateMissions(dt) {
  const m = currentMission(g.ms);
  g.missionMarker = missionMarker(g.ms);
  if (g.ms.bannerT > 0) g.ms.bannerT -= dt;
  if (!m || g.ms.phase !== 'active') return;
  const p = g.player;
  if (m.kind === 'welcome') {
    if (Math.hypot(p.x - LANDMARKS.marlinClub.x, p.y - LANDMARKS.marlinClub.y) < 80) {
      awardMission();
    }
  } else if (m.kind === 'steal-deliver') {
    if (g.ms.stage === 0 && p.inCar && p.car?.missionCar) {
      g.ms.stage = 1;
      g.ms.banner = 'Got the Comet! Now deliver it to Vic’s Garage.';
      g.ms.bannerT = 3;
      sfxMission(audio);
    }
    if (g.ms.stage === 1 && Math.hypot(p.x - LANDMARKS.garage.x, p.y - LANDMARKS.garage.y) < 90) {
      awardMission();
      if (p.car) { p.car.missionCar = false; }
    }
  } else if (m.kind === 'wreck') {
    if (!g.ms.stageData) {
      const viper = makeCar(CAR_TYPES[6], 800, 1200, 0, { driver: 'viper' });
      viper.type = { ...CAR_TYPES[6], color: '#7a1010', name: 'Viper Sedan' };
      viper.hp = 120;
      g.cars.push(viper);
      g.ms.stageData = { car: viper };
      g.ms.banner = 'The Viper sedan is circling Old Town. Wreck it!';
      g.ms.bannerT = 4;
    }
    const v = g.ms.stageData.car;
    if (v.dead) {
      awardMission();
    } else {
      // Viper flees from the player.
      const dx = v.x - p.x, dy = v.y - p.y;
      const d = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let diff = want - v.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.angle += Math.max(-1, Math.min(1, diff * 2)) * 2.6 * dt;
      v.speed = Math.min(380, v.speed + 300 * dt);
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;
      if (buildingHit(v.x, v.y, 20)) { v.angle += Math.PI / 2; v.speed *= 0.5; }
      clampToWorld(v, 30);
    }
  } else if (m.kind === 'collect') {
    if (g.ms.stage === 0 && g.ms.collected === 0 && !g.ms.stageData) {
      // Spawn the three packages as pickups.
      for (const pk of m.pickups) g.pickups.push({ x: pk.x, y: pk.y, kind: 'package' });
      g.ms.stageData = { spawned: true };
    }
    if (g.ms.stage === 1 && Math.hypot(p.x - LANDMARKS.hideout.x, p.y - LANDMARKS.hideout.y) < 90) {
      awardMission();
    }
  } else if (m.kind === 'escape') {
    if (!g.ms.stageData) {
      commitCrime(60);
      g.ms.stageData = { started: true };
      g.ms.timer = 45;
    }
    g.ms.timer -= dt;
    if (Math.hypot(p.x - LANDMARKS.hideout.x, p.y - LANDMARKS.hideout.y) < 90) {
      awardMission();
      addHeat(g.wanted, -100);
    } else if (g.wanted.stars === 0) {
      awardMission();
    } else if (g.ms.timer <= 0) {
      failMission(g.ms, 'The heat never let up.');
      sfxFail(audio);
    }
  } else if (m.kind === 'heist') {
    if (g.ms.stage === 1 && Math.hypot(p.x - LANDMARKS.hideout.x, p.y - LANDMARKS.hideout.y) < 90) {
      awardMission();
    }
  }
}

// --- Police / wanted -----------------------------------------------------------

function updatePolice(dt) {
  const p = g.player;
  updateWanted(g.wanted, dt, g.crimeThisFrame);
  const want = wantedCopCount(g.wanted.stars);
  const copCars = g.cars.filter((c) => c.driver === 'cop' && !c.dead);
  // Spawn cop cars up to the wanted level.
  if (copCars.length < want && Math.random() < dt * 1.2) {
    g.cars.push(spawnCopCar(p));
  }
  // Remove excess cops when heat falls.
  if (copCars.length > want) {
    const extra = copCars[copCars.length - 1];
    extra.dead = true;
    g.cars = g.cars.filter((c) => c !== extra);
  }
  // Cop cars chase the player (car or on foot).
  for (const c of g.cars) {
    if (c.driver !== 'cop' || c.dead) continue;
    updateCopCar(c, p, dt);
    // Ram the player's car.
    if (p.inCar && p.car) {
      const d = Math.hypot(c.x - p.car.x, c.y - p.car.y);
      if (d < 48) {
        damageCar(p.car, 5 * dt, false);
        p.car.speed *= 0.985;
        if (Math.random() < dt * 4) spawnParticles(g.fx, (c.x + p.car.x) / 2, (c.y + p.car.y) / 2, { n: 4, speed: 120, life: 0.3, size: 3, color: '#ffd166' });
      }
    }
    if (buildingHit(c.x, c.y, 20)) { resolveBuildingCollision(c, 20); c.speed *= 0.4; }
  }
  // On-foot officers when the player is on foot and wanted.
  if (!p.inCar && g.wanted.stars > 0) {
    const wantFoot = Math.min(3, g.wanted.stars);
    if (g.footCops.length < wantFoot && Math.random() < dt * 0.8) {
      const spot = randomRoadPoint(p);
      g.footCops.push(makeFootCop(spot.x, spot.y));
    }
  }
  let busted = false;
  for (const cop of g.footCops) {
    const dmg = updateFootCop(cop, p, dt);
    if (dmg > 0) {
      p.hp -= dmg;
      sfxPunch(audio);
      spawnParticles(g.fx, p.x, p.y, { n: 6, speed: 100, life: 0.4, size: 4, color: '#ff6b6b' });
    }
    if (Math.hypot(cop.x - p.x, cop.y - p.y) < 30) {
      g.wanted.bustedTimer += dt;
      if (g.wanted.bustedTimer > 3.5) busted = true;
    }
  }
  // Decay the busted timer when no cop is touching the player.
  if (!p.inCar && g.footCops.length > 0) {
    const touching = g.footCops.some((cop) => Math.hypot(cop.x - p.x, cop.y - p.y) < 30);
    if (!touching) g.wanted.bustedTimer = Math.max(0, g.wanted.bustedTimer - dt);
  }
  if (g.wanted.stars === 0) {
    g.footCops = [];
    g.wanted.bustedTimer = 0;
  }
  if (busted) endRun('busted');
  setSiren(audio, g.wanted.stars > 0 && copCars.length > 0, g.time);
}

function endRun(kind) {
  const p = g.player;
  g.endKind = kind;
  g.state = kind;
  g.endTimer = 0;
  // Lose 10% cash, wake up at the hospital, heat gone.
  g.cash = Math.floor(g.cash * 0.9);
  p.hp = 100;
  p.x = LANDMARKS.hospital.x; p.y = LANDMARKS.hospital.y;
  if (p.inCar) { p.car.driver = null; p.car = null; p.inCar = false; }
  g.wanted = makeWanted();
  g.footCops = [];
  g.cars = g.cars.filter((c) => c.driver !== 'cop');
  if (g.ms.phase === 'active') failMission(g.ms, kind === 'busted' ? 'You got busted.' : 'You went down.');
  saveGame(g);
  sfxFail(audio);
}

// --- World maintenance -------------------------------------------------------

function updateWorld(dt) {
  const p = g.player;
  // Traffic.
  for (const c of g.cars) {
    if (c.dead) continue;
    if (c.driver === 'traffic') updateTrafficCar(c, dt, g.cars);
  }
  // Keep traffic + peds populated.
  g.trafficTimer -= dt;
  if (g.trafficTimer <= 0) {
    g.trafficTimer = 1.5;
    const traffic = g.cars.filter((c) => c.driver === 'traffic').length;
    if (traffic < 18) g.cars.push(spawnTrafficCar(p));
    if (g.peds.filter((x) => x.state !== 'down').length < 34) g.peds.push(spawnPed(p));
  }
  // Remove dead cars (after explosion) and far-away parked cars.
  g.cars = g.cars.filter((c) => {
    if (c.dead) return false;
    if (c.driver === null && Math.hypot(c.x - p.x, c.y - p.y) > 1600) return false;
    return true;
  });
  if (g.cars.filter((c) => c.driver === null).length < 10) g.cars.push(spawnParkedCar(p));
  // Peds.
  for (const ped of g.peds) updatePed(ped, dt);
  g.peds = g.peds.filter((ped) => ped.state !== 'down' || Math.hypot(ped.x - p.x, ped.y - p.y) < 900);
  // Bullets.
  updateBullets(g.combat, dt, (b) => {
    // Buildings stop bullets.
    if (buildingHit(b.x, b.y, 2)) { b.life = 0; return; }
    for (const ped of g.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
        ped.hp -= b.damage;
        b.life = 0;
        spawnParticles(g.fx, ped.x, ped.y, { n: 8, speed: 120, life: 0.4, size: 4, color: '#ff6b6b' });
        if (ped.hp <= 0) {
          ped.state = 'down';
          commitCrime(15);
          addFloat(g.fx, ped.x, ped.y - 20, 'PED DOWN!', '#ff6b6b');
          scarePeds(g.peds, ped.x, ped.y, 220);
        }
        return;
      }
    }
    for (const c of g.cars) {
      if (c.dead || c.driver === 'player') continue;
      if (Math.hypot(c.x - b.x, c.y - b.y) < 26) {
        b.life = 0;
        damageCar(c, b.damage, true);
        spawnParticles(g.fx, b.x, b.y, { n: 6, speed: 140, life: 0.3, size: 3, color: '#ffd166' });
        if (c.driver === 'cop' || c.driver === 'viper') commitCrime(8);
        return;
      }
    }
    for (const cop of g.footCops) {
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
        b.life = 0;
        cop.hp -= b.damage;
        spawnParticles(g.fx, cop.x, cop.y, { n: 8, speed: 120, life: 0.4, size: 4, color: '#3f8cff' });
        if (cop.hp <= 0) {
          g.footCops = g.footCops.filter((x) => x !== cop);
          commitCrime(20);
          addFloat(g.fx, cop.x, cop.y - 20, 'COP DOWN!', '#3f8cff');
        }
        return;
      }
    }
  });
  // Cash pickups respawn.
  g.cashTimer -= dt;
  if (g.cashTimer <= 0) {
    g.cashTimer = 8;
    if (g.pickups.filter((pk) => pk.kind === 'cash').length < 6) spawnCashPickup();
    if (Math.random() < 0.4 && !g.pickups.some((pk) => pk.kind === 'smg')) spawnSmgPickup();
  }
  // Player health regen (slow) when not wanted.
  if (g.wanted.stars === 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 2 * dt);
  // Player car destroyed while driving.
  if (p.inCar && p.car && p.car.hp <= 0) {
    p.inCar = false; p.car = null;
    p.x += 30; p.y += 30;
    p.hp -= 25;
    addFloat(g.fx, p.x, p.y - 20, 'CAR WRECKED!', '#ff6b6b');
  }
  if (p.hp <= 0) { endRun('wasted'); return; }
  // Camera follows the player.
  const tx = Math.max(640, Math.min(WORLD_W - 640, p.x));
  const ty = Math.max(400, Math.min(WORLD_H - 400, p.y));
  g.camera.x += (tx - g.camera.x) * Math.min(1, 5 * dt);
  g.camera.y += (ty - g.camera.y) * Math.min(1, 5 * dt);
  g.district = districtAt(p.x, p.y);
  updateEffects(g.fx, dt);
  // Engine sound.
  setEngine(audio, p.inCar ? Math.abs(p.car.speed) / 550 : 0, p.inCar);
  updateMusic(audio, dt, g.state === 'playing');
  // Context prompt.
  g.prompt = null;
  if (!p.inCar) {
    const c = nearestCar(p.x, p.y, 70);
    if (c) g.prompt = c.driver === 'traffic' ? `E — STEAL ${c.type.name.toUpperCase()}` : `E — ENTER ${c.type.name.toUpperCase()}`;
    else if (g.ms.phase === 'active') {
      const m = currentMission(g.ms);
      if (m?.kind === 'welcome' && Math.hypot(p.x - LANDMARKS.marlinClub.x, p.y - LANDMARKS.marlinClub.y) < 80) g.prompt = 'E — MEET SAL';
      if (m?.kind === 'heist' && g.ms.stage === 0 && Math.hypot(p.x - LANDMARKS.bank.x, p.y - LANDMARKS.bank.y) < 80) g.prompt = 'E — GRAB THE CASH';
    }
  } else {
    g.prompt = 'E — EXIT CAR';
  }
}

// --- Menu / state handling ---------------------------------------------------

function clickMenuButton() {
  if (!consumeClick()) return null;
  for (const b of g.menuButtons) {
    if (g.mouse.x >= b.x && g.mouse.x <= b.x + b.w && g.mouse.y >= b.y && g.mouse.y <= b.y + b.h) return b;
  }
  return null;
}

function update(dt) {
  g.time += dt;
  if (g.state === 'menu') {
    const b = clickMenuButton();
    if (b || consume('enter')) {
      startAudio(audio);
      sfxClick(audio);
      if (b?.label === 'CONTINUE' || (!b && hasSave())) {
        resetWorld(loadGame());
      } else {
        resetWorld(null);
      }
      g.state = 'playing';
    }
    return;
  }
  if (g.state === 'paused') {
    const b = clickMenuButton();
    if (b?.id === 'resume' || consume('pause')) { g.state = 'playing'; sfxClick(audio); }
    else if (b?.id === 'save') {
      g.saveMessage = saveGame(g) ? 'Game saved.' : 'Save failed.';
      sfxClick(audio);
    } else if (b?.id === 'quit') { g.state = 'menu'; sfxClick(audio); }
    return;
  }
  if (g.state === 'phone') {
    if (consume('phone') || consume('pause')) { g.state = 'playing'; sfxClick(audio); }
    else if (consume('enter')) {
      if (startMission(g.ms)) { sfxMission(audio); g.state = 'playing'; }
    }
    return;
  }
  if (g.state === 'busted' || g.state === 'wasted') {
    g.endTimer += dt;
    if (g.endTimer > 0.8 && (consume('enter') || consumeClick())) {
      g.state = 'playing';
      sfxClick(audio);
    }
    return;
  }
  // playing
  if (consume('pause')) { g.state = 'paused'; g.saveMessage = ''; sfxClick(audio); return; }
  if (consume('phone')) { g.state = 'phone'; sfxClick(audio); return; }
  g.crimeThisFrame = false;
  if (g.player.inCar) updatePlayerCar(dt);
  else updatePlayerOnFoot(dt);
  updateMissions(dt);
  updatePolice(dt);
  if (g.state !== 'playing') return; // endRun may have switched state
  updateWorld(dt);
  // Player car explosion handled in updateWorld via hp check.
  if (g.player.inCar && g.player.car?.dead) {
    g.player.inCar = false; g.player.car = null;
  }
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (g.state === 'menu') {
    drawStartScreen(ctx, g, W, H, hasSave());
    return;
  }
  // World view (also behind pause/phone overlays).
  const cam = g.camera;
  ctx.save();
  if (g.fx.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * g.fx.shake, (Math.random() - 0.5) * g.fx.shake);
  }
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
  drawWorld(ctx, g, cam, g.time);
  ctx.restore();
  if (g.fx.flash > 0) {
    ctx.fillStyle = `rgba(255,240,200,${g.fx.flash})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.state === 'playing') drawHud(ctx, g, W, H);
  else if (g.state === 'paused') { drawHud(ctx, g, W, H); drawPauseScreen(ctx, g, W, H); }
  else if (g.state === 'phone') { drawHud(ctx, g, W, H); drawPhoneScreen(ctx, g, W, H); }
  else if (g.state === 'busted' || g.state === 'wasted') drawEndScreen(ctx, g, W, H, g.state);
}

// --- Boot --------------------------------------------------------------------

resetWorld(null);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
  } catch (e) {
    console.error('update error', e);
  }
  try {
    render();
  } catch (e) {
    console.error('render error', e);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
