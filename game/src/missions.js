// missions.js — the story of PORT SOLARA and its six missions.
// One job: what the next job is, where it points, and when it is done.
// Jace "Jay" Moreno, a getaway driver back in his hometown, owes the Marlin
// Club. Each mission pays cash and moves the story forward.

import { LANDMARKS } from './city.js';

export const MISSIONS = [
  {
    id: 'welcome',
    title: 'Welcome Back',
    brief: 'Sal wants to see you. Drive to the Marlin Club in Downtown.',
    target: () => LANDMARKS.marlinClub,
    targetText: 'Go to The Marlin Club',
    reward: 150,
    kind: 'welcome',
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    brief: "Vic needs a Comet coupe from the Sunset Auto Lot. Steal it and bring it to his garage.",
    target: () => LANDMARKS.carLot,
    targetText: 'Steal the Comet at Sunset Auto Lot',
    reward: 400,
    kind: 'steal-deliver',
    carType: 'Comet',
    deliver: () => LANDMARKS.garage,
  },
  {
    id: 'payback',
    title: 'Payback',
    brief: 'A Viper sedan is circling Old Town. Wreck it — ram it until it burns.',
    target: () => ({ x: 800, y: 1200, name: 'Viper Sedan' }),
    targetText: 'Wreck the Viper sedan',
    reward: 600,
    kind: 'wreck',
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    brief: 'Three packages are stashed around the city. Collect them all, then drop them at the hideout.',
    target: () => LANDMARKS.beachBar,
    targetText: 'Collect the packages (0/3)',
    reward: 800,
    kind: 'collect',
    pickups: [
      { x: 1200, y: 2240, name: 'Tide & Lime Bar' },
      { x: 160, y: 500, name: 'Harbor Pier' },
      { x: 2640, y: 1640, name: 'Barrio Corner' },
    ],
    deliver: () => LANDMARKS.hideout,
  },
  {
    id: 'heatwave',
    title: 'Heat Wave',
    brief: 'The cops are onto you. Lose the heat: stay out of sight for 45 seconds, or reach the hideout.',
    target: () => LANDMARKS.hideout,
    targetText: 'Lose the cops — reach the hideout',
    reward: 1000,
    kind: 'escape',
    duration: 45,
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    brief: 'Solara National Bank. Walk in, grab the cash, and get out. The whole city will be looking for you.',
    target: () => LANDMARKS.bank,
    targetText: 'Rob Solara National Bank',
    reward: 2500,
    kind: 'heist',
  },
];

export function makeMissionState(completedCount) {
  return {
    index: Math.min(completedCount, MISSIONS.length - 1),
    active: false,
    phase: 'idle',      // idle | active | done
    stage: 0,           // per-mission sub-stage
    stageData: null,
    timer: 0,
    collected: 0,
    banner: null,
    bannerT: 0,
  };
}

export function currentMission(ms) {
  return MISSIONS[ms.index] ?? null;
}

export function missionsComplete(ms) {
  return ms.index >= MISSIONS.length;
}

/** The mission's current objective marker (world coords + label). */
export function missionMarker(ms) {
  const m = currentMission(ms);
  if (!m || ms.phase !== 'active') return null;
  if (m.kind === 'steal-deliver') {
    return ms.stage === 0
      ? { x: m.target().x, y: m.target().y, label: m.targetText }
      : { x: m.deliver().x, y: m.deliver().y, label: "Deliver to Vic's Garage" };
  }
  if (m.kind === 'collect') {
    if (ms.stage === 0) {
      const p = m.pickups[ms.collected];
      return p ? { x: p.x, y: p.y, label: `Package ${ms.collected + 1}/3 — ${p.name}` } : null;
    }
    return { x: m.deliver().x, y: m.deliver().y, label: 'Deliver the packages to the hideout' };
  }
  if (m.kind === 'wreck' && ms.stageData?.car) {
    return { x: ms.stageData.car.x, y: ms.stageData.car.y, label: 'Viper Sedan — wreck it!' };
  }
  if (m.kind === 'heist') {
    return ms.stage === 0
      ? { x: m.target().x, y: m.target().y, label: 'Enter the bank' }
      : { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y, label: 'Escape to the hideout!' };
  }
  return { x: m.target().x, y: m.target().y, label: m.targetText };
}

export function missionObjectiveText(ms) {
  const m = currentMission(ms);
  if (!m) return 'All missions complete — Port Solara is yours.';
  if (ms.phase !== 'active') return `Next: ${m.title} — press M to start`;
  if (m.kind === 'steal-deliver') return ms.stage === 0 ? 'Steal the Comet at Sunset Auto Lot' : "Deliver the Comet to Vic's Garage";
  if (m.kind === 'collect') return ms.stage === 0 ? `Collect packages (${ms.collected}/3)` : 'Deliver the packages to the hideout';
  if (m.kind === 'wreck') return 'Wreck the Viper sedan';
  if (m.kind === 'escape') return `Lose the heat — ${Math.ceil(ms.timer)}s left`;
  if (m.kind === 'heist') return ms.stage === 0 ? 'Grab the cash inside the bank' : 'Escape to the hideout!';
  return m.targetText;
}

export function startMission(ms) {
  const m = currentMission(ms);
  if (!m || ms.phase === 'active') return false;
  ms.phase = 'active';
  ms.stage = 0;
  ms.collected = 0;
  ms.timer = m.duration ?? 0;
  ms.stageData = null;
  ms.banner = `${m.title} — ${m.brief}`;
  ms.bannerT = 5;
  return true;
}

export function completeMission(ms) {
  const m = currentMission(ms);
  ms.phase = 'done';
  ms.banner = `MISSION COMPLETE — ${m.title}  +$${m.reward}`;
  ms.bannerT = 4;
  ms.index++;
  if (ms.index < MISSIONS.length) {
    ms.phase = 'idle';
    ms.stage = 0;
    ms.collected = 0;
    ms.stageData = null;
  }
  return m.reward;
}

export function failMission(ms, reason) {
  ms.phase = 'idle';
  ms.stage = 0;
  ms.collected = 0;
  ms.stageData = null;
  ms.banner = `MISSION FAILED — ${reason}`;
  ms.bannerT = 4;
}
