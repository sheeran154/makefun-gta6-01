// audio.js — all sound is synthesized with WebAudio. No audio files.
// One job: engine hum, sirens, gunshots, pickups, explosions, and a small
// bass-driven music loop. Starts only after a user gesture.

export function makeAudio() {
  return {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    started: false,
    musicTimer: 0,
    beat: 0,
    muted: false,
  };
}

export function startAudio(a) {
  if (a.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: sawtooth through a lowpass; pitch follows speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineFilter = a.ctx.createBiquadFilter();
    a.engineFilter.type = 'lowpass';
    a.engineFilter.frequency.value = 320;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engineOsc.connect(a.engineFilter);
    a.engineFilter.connect(a.engineGain);
    a.engineGain.connect(a.master);
    a.engineOsc.start();
    // Siren: triangle that wails between two notes.
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain);
    a.sirenGain.connect(a.master);
    a.sirenOsc.start();
    a.musicGain = a.ctx.createGain();
    a.musicGain.gain.value = 0.16;
    a.musicGain.connect(a.master);
    a.started = true;
  } catch (e) {
    a.started = false;
  }
}

function tone(a, freq, dur, type, vol, when = 0, slideTo = null) {
  if (!a.started || a.muted) return;
  const t0 = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(a.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(a, dur, vol, filterFreq, when = 0) {
  if (!a.started || a.muted) return;
  const t0 = a.ctx.currentTime + when;
  const len = Math.max(1, Math.floor(a.ctx.sampleRate * dur));
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = a.ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.master);
  src.start(t0);
}

export function sfxGunshot(a) { noise(a, 0.12, 0.5, 2400); tone(a, 160, 0.08, 'square', 0.18, 0, 60); }
export function sfxPickup(a) { tone(a, 660, 0.1, 'sine', 0.3); tone(a, 880, 0.12, 'sine', 0.3, 0.08); tone(a, 1320, 0.18, 'sine', 0.25, 0.16); }
export function sfxCash(a) { tone(a, 990, 0.09, 'triangle', 0.3); tone(a, 1480, 0.16, 'triangle', 0.28, 0.07); }
export function sfxExplosion(a) { noise(a, 0.7, 0.8, 500); tone(a, 90, 0.5, 'sine', 0.5, 0, 30); }
export function sfxHorn(a) { tone(a, 370, 0.18, 'square', 0.12); tone(a, 466, 0.18, 'square', 0.1, 0.02); }
export function sfxPunch(a) { noise(a, 0.08, 0.4, 900); }
export function sfxClick(a) { tone(a, 1200, 0.05, 'square', 0.12); }
export function sfxMission(a) { tone(a, 523, 0.12, 'triangle', 0.3); tone(a, 659, 0.12, 'triangle', 0.3, 0.1); tone(a, 784, 0.24, 'triangle', 0.3, 0.2); }
export function sfxFail(a) { tone(a, 220, 0.25, 'sawtooth', 0.2, 0, 110); }

/** Engine hum follows the player's car speed (0 = silent). */
export function setEngine(a, speed01, on) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  a.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  a.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.1);
  a.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
}

/** Two-tone police siren while any cop is near. */
export function setSiren(a, on, phase) {
  if (!a.started) return;
  const t = a.ctx.currentTime;
  a.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.2);
  if (on) a.sirenOsc.frequency.setTargetAtTime(phase % 1 < 0.5 ? 700 : 950, t, 0.05);
}

// A laid-back bass line + hats, 112 BPM, minor-key groove. Pure oscillators.
const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
export function updateMusic(a, dt, playing) {
  if (!a.started || !playing) return;
  a.musicTimer -= dt;
  if (a.musicTimer > 0) return;
  const step = 60 / 112 / 2;
  a.musicTimer = step;
  const note = BASS[a.beat % BASS.length];
  if (note) tone(a, note, step * 1.8, 'triangle', 0.5);
  if (a.beat % 4 === 2) noise(a, 0.03, 0.08, 6000); // hat
  if (a.beat % 16 === 0) tone(a, 220, 0.2, 'sine', 0.12); // root sparkle
  a.beat++;
}
