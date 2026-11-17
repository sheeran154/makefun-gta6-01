// save.js — saving to localStorage. One job: persist and restore progress.

const KEY = 'portSolaraSaveV1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionsDone: state.missionsDone,
      player: { x: state.player.x, y: state.player.y, hp: state.player.hp },
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionsDone !== 'number') return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
