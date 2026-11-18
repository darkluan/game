import type { SoundCue } from './session';

/**
 * Game sounds. Weapons, hits and other physical things are short CC0 recordings; everything else,
 * and a layer under most recordings, is synthesised with WebAudio from oscillator and noise bursts.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Where game sounds go: straight to the master and, quieter, through an echo that gives them room. */
let effects: GainNode | null = null;
let muted = false;
const MASTER_GAIN = 0.35;
const lastPlayed = new Map<SoundCue, number>();
/** The same cue cannot retrigger faster than this, so a team fight does not turn into a buzz. */
const MIN_GAP_SECONDS = 0.05;
/** Sounds that many units make at once get a longer gap. */
const CROWD_GAP_SECONDS = 0.11;
const CROWD_CUES = new Set<SoundCue>(['minionHit', 'minionShot', 'minionDeath', 'impact']);

/** The echo of an open field: a short burst of noise that dies away. */
function echoImpulse(c: AudioContext): AudioBuffer {
  const seconds = 1.1;
  const buffer = c.createBuffer(2, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  }
  return buffer;
}

/** Browsers only allow audio after a user gesture: call this from a click handler. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      // Evens out the peaks of a team fight, so many sounds at once stay clear instead of clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.ratio.value = 6;
      master.connect(limiter).connect(ctx.destination);
      effects = ctx.createGain();
      effects.connect(master);
      const echo = ctx.createConvolver();
      echo.buffer = echoImpulse(ctx);
      const echoLevel = ctx.createGain();
      echoLevel.gain.value = 0.28;
      effects.connect(echo).connect(echoLevel).connect(master);
    }
    loadRecordings(ctx);
    void ctx.resume();
  } catch {
    // No audio device or blocked by the browser: the game simply stays silent.
    ctx = null;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master) master.gain.value = value ? 0 : MASTER_GAIN;
}

/** The shared audio graph, or null until unlockAudio() has run. Music plugs in here too. */
export function audioOutput(): { ctx: AudioContext; out: AudioNode } | null {
  return ctx && master ? { ctx, out: master } : null;
}

interface Tone {
  type: OscillatorType;
  from: number;
  to?: number;
  at?: number;
  duration: number;
  gain: number;
  /** Seconds to swell from silence; 0 starts at full strength, like something struck. */
  attack?: number;
}

/** What a cue plays into. `pitch` shifts everything a little so the same sound never repeats exactly. */
interface Voice {
  c: AudioContext;
  out: AudioNode;
  volume: number;
  pitch: number;
}

function tone(v: Voice, t: Tone): void {
  const start = v.c.currentTime + (t.at ?? 0);
  const osc = v.c.createOscillator();
  const gain = v.c.createGain();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.from * v.pitch, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to * v.pitch, start + t.duration);
  const peak = t.gain * v.volume;
  if (t.attack) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + t.attack);
  } else gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.duration);
  osc.connect(gain).connect(v.out);
  osc.start(start);
  osc.stop(start + t.duration);
}

interface Noise {
  duration: number;
  gain: number;
  /** lowpass: a thud or rumble. bandpass: a whoosh or hiss. highpass: a click or sizzle. */
  filter?: BiquadFilterType;
  from: number;
  /** The filter sweeps to this frequency; upward sounds like something passing, downward like it landing. */
  to?: number;
  at?: number;
  attack?: number;
  q?: number;
}

let noiseBuffer: AudioBuffer | null = null;

function noise(v: Voice, n: Noise): void {
  // One second of noise, made once and shared by every sound.
  if (!noiseBuffer || noiseBuffer.sampleRate !== v.c.sampleRate) {
    noiseBuffer = v.c.createBuffer(1, v.c.sampleRate, v.c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const start = v.c.currentTime + (n.at ?? 0);
  const source = v.c.createBufferSource();
  const filter = v.c.createBiquadFilter();
  const gain = v.c.createGain();
  source.buffer = noiseBuffer;
  source.loop = true;
  filter.type = n.filter ?? 'lowpass';
  filter.Q.value = n.q ?? 1;
  filter.frequency.setValueAtTime(n.from, start);
  if (n.to) filter.frequency.exponentialRampToValueAtTime(n.to, start + n.duration);
  const peak = n.gain * v.volume;
  if (n.attack) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + n.attack);
  } else gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + n.duration);
  source.connect(filter).connect(gain).connect(v.out);
  // Start somewhere random in the buffer so two noises at once are not the same noise twice.
  source.start(start, Math.random() * 0.5);
  source.stop(start + n.duration);
}

/** Metal struck: a few high notes that do not belong to one chord, ringing briefly. */
function clang(v: Voice, base: number, duration: number, gain: number, at = 0): void {
  for (const ratio of [1, 1.47, 2.09, 2.83])
    tone(v, { type: 'square', from: base * ratio, at, duration: duration / Math.sqrt(ratio), gain: gain / ratio });
}

/** Something heavy landing. */
function thud(v: Voice, gain: number, at = 0, duration = 0.18): void {
  tone(v, { type: 'sine', from: 150, to: 42, at, duration, gain });
  noise(v, { from: 700, to: 120, at, duration: duration * 0.8, gain: gain * 0.7 });
}

/** Air moving past. */
function whoosh(v: Voice, from: number, to: number, duration: number, gain: number, at = 0): void {
  noise(v, { filter: 'bandpass', from, to, at, duration, gain, attack: duration * 0.35, q: 1.4 });
}

const notes = (freqs: number[], step: number, type: OscillatorType, gain: number): Tone[] =>
  freqs.map((from, i) => ({ type, from, at: i * step, duration: step * 1.8, gain }));

const CUES: Record<SoundCue, (v: Voice) => void> = {
  // Basic attacks, by what is doing the hitting.
  swing: (v) => {
    whoosh(v, 900, 3200, 0.11, 0.5);
    clang(v, 1250, 0.12, 0.13, 0.07);
    thud(v, 0.35, 0.07, 0.1);
  },
  arrow: (v) => {
    // The string, then the arrow through the air.
    tone(v, { type: 'triangle', from: 420, to: 170, duration: 0.07, gain: 0.4 });
    whoosh(v, 2400, 5200, 0.16, 0.3, 0.02);
  },
  magic: (v) => {
    tone(v, { type: 'sine', from: 880, to: 1500, duration: 0.14, gain: 0.25 });
    tone(v, { type: 'triangle', from: 1320, to: 660, duration: 0.18, gain: 0.14, at: 0.03 });
    whoosh(v, 1800, 4200, 0.14, 0.18);
  },
  claw: (v) => {
    for (let i = 0; i < 3; i++) whoosh(v, 1400 + i * 500, 3600, 0.07, 0.4, i * 0.028);
    thud(v, 0.45, 0.05, 0.12);
  },
  gun: (v) => {
    noise(v, { filter: 'highpass', from: 1800, duration: 0.05, gain: 0.55 });
    tone(v, { type: 'square', from: 240, to: 70, duration: 0.09, gain: 0.4 });
    noise(v, { from: 2400, to: 300, duration: 0.14, gain: 0.3, at: 0.02 });
  },
  blade: (v) => {
    whoosh(v, 2600, 6000, 0.08, 0.4);
    clang(v, 1900, 0.09, 0.1, 0.04);
  },
  minionHit: (v) => {
    noise(v, { from: 1500, to: 400, duration: 0.06, gain: 0.3 });
    tone(v, { type: 'triangle', from: 210, to: 110, duration: 0.06, gain: 0.25 });
  },
  minionShot: (v) => whoosh(v, 2000, 4000, 0.1, 0.2),
  tower: (v) => {
    tone(v, { type: 'sawtooth', from: 620, to: 130, duration: 0.24, gain: 0.3 });
    noise(v, { filter: 'bandpass', from: 3000, to: 500, duration: 0.2, gain: 0.3 });
    thud(v, 0.3, 0.02, 0.2);
  },
  /** A hero taking a hit: what makes a blow feel like it landed. */
  impact: (v) => {
    thud(v, 0.5, 0, 0.11);
    noise(v, { filter: 'highpass', from: 2500, duration: 0.03, gain: 0.25 });
  },

  // Abilities, by what they are made of.
  dash: (v) => {
    whoosh(v, 400, 2600, 0.26, 0.6);
    thud(v, 0.5, 0.2, 0.16);
  },
  guard: (v) => {
    clang(v, 520, 0.5, 0.2);
    tone(v, { type: 'sine', from: 260, to: 392, duration: 0.45, gain: 0.3, attack: 0.05 });
  },
  bash: (v) => {
    thud(v, 0.8, 0, 0.2);
    clang(v, 700, 0.28, 0.22);
    notes([1568, 2093], 0.07, 'sine', 0.12).forEach((t) => tone(v, { ...t, at: (t.at ?? 0) + 0.08 }));
  },
  slam: (v) => {
    whoosh(v, 1200, 300, 0.2, 0.4);
    thud(v, 1, 0.16, 0.5);
    noise(v, { from: 900, to: 80, duration: 0.7, gain: 0.7, at: 0.16 });
    clang(v, 330, 0.5, 0.12, 0.16);
  },
  trap: (v) => {
    clang(v, 1500, 0.07, 0.16);
    clang(v, 1100, 0.12, 0.18, 0.09);
  },
  mark: (v) => {
    notes([1175, 1568], 0.09, 'square', 0.1).forEach((t) => tone(v, t));
    tone(v, { type: 'sine', from: 2349, duration: 0.35, gain: 0.12, at: 0.18 });
  },
  tumble: (v) => whoosh(v, 700, 2800, 0.22, 0.5),
  snipe: (v) => {
    tone(v, { type: 'triangle', from: 300, to: 110, duration: 0.12, gain: 0.6 });
    whoosh(v, 1500, 7000, 0.4, 0.55, 0.03);
    thud(v, 0.6, 0, 0.25);
  },
  fire: (v) => {
    noise(v, { filter: 'bandpass', from: 500, to: 1800, duration: 0.55, gain: 0.7, attack: 0.08, q: 0.7 });
    noise(v, { filter: 'highpass', from: 3000, duration: 0.5, gain: 0.14, attack: 0.1 });
    tone(v, { type: 'sawtooth', from: 90, to: 60, duration: 0.5, gain: 0.25, attack: 0.05 });
  },
  explosion: (v) => {
    whoosh(v, 600, 1800, 0.12, 0.3);
    thud(v, 0.9, 0.1, 0.4);
    noise(v, { from: 2200, to: 150, duration: 0.6, gain: 0.8, at: 0.1 });
  },
  wind: (v) => {
    whoosh(v, 300, 1600, 0.5, 0.8);
    whoosh(v, 900, 3000, 0.4, 0.3, 0.06);
  },
  firestorm: (v) => {
    thud(v, 0.9, 0, 0.6);
    noise(v, { filter: 'bandpass', from: 350, to: 1500, duration: 1.4, gain: 0.8, attack: 0.2, q: 0.6 });
    for (let i = 0; i < 5; i++)
      noise(v, { filter: 'highpass', from: 2200, duration: 0.08, gain: 0.25, at: 0.25 + i * 0.2 });
  },
  earth: (v) => {
    thud(v, 0.9, 0, 0.35);
    noise(v, { from: 500, to: 70, duration: 0.6, gain: 0.8 });
    for (let i = 0; i < 3; i++) noise(v, { from: 1400, to: 300, duration: 0.06, gain: 0.3, at: 0.12 + i * 0.09 });
  },
  stone: (v) => {
    noise(v, { from: 2000, to: 200, duration: 0.4, gain: 0.6, attack: 0.1 });
    tone(v, { type: 'triangle', from: 180, to: 70, duration: 0.45, gain: 0.5 });
    clang(v, 240, 0.3, 0.1, 0.3);
  },
  quake: (v) => {
    thud(v, 1, 0, 0.7);
    tone(v, { type: 'sine', from: 60, to: 32, duration: 1.1, gain: 0.9 });
    noise(v, { from: 600, to: 60, duration: 1.1, gain: 0.9 });
    for (let i = 0; i < 4; i++) thud(v, 0.35, 0.2 + i * 0.16, 0.14);
  },
  heal: (v) => {
    notes([659, 880, 1109, 1319], 0.07, 'sine', 0.22).forEach((t) => tone(v, t));
    tone(v, { type: 'triangle', from: 440, to: 880, duration: 0.5, gain: 0.12, attack: 0.1 });
  },
  light: (v) => {
    tone(v, { type: 'sawtooth', from: 1760, to: 880, duration: 0.3, gain: 0.14 });
    tone(v, { type: 'sine', from: 2637, to: 1319, duration: 0.35, gain: 0.2 });
    whoosh(v, 3000, 7000, 0.22, 0.25);
  },
  dawn: (v) => {
    // A bright chord opening upward.
    for (const [from, at] of [
      [392, 0],
      [494, 0.06],
      [587, 0.12],
      [784, 0.18],
      [1175, 0.26],
    ])
      tone(v, { type: 'triangle', from, at, duration: 1.2, gain: 0.2, attack: 0.08 });
    whoosh(v, 800, 5000, 0.9, 0.25);
  },
  stab: (v) => {
    whoosh(v, 3000, 800, 0.1, 0.35);
    whoosh(v, 2600, 6500, 0.07, 0.45, 0.1);
    thud(v, 0.5, 0.13, 0.1);
  },
  shadow: (v) => {
    noise(v, { filter: 'bandpass', from: 1800, to: 250, duration: 0.6, gain: 0.6, attack: 0.05, q: 2 });
    tone(v, { type: 'sine', from: 220, to: 98, duration: 0.6, gain: 0.3, attack: 0.05 });
  },
  darkness: (v) => {
    for (const from of [73, 110, 116])
      tone(v, { type: 'sawtooth', from, to: from * 0.7, duration: 1.3, gain: 0.22, attack: 0.15 });
    noise(v, { filter: 'bandpass', from: 2400, to: 200, duration: 1.2, gain: 0.5, attack: 0.1, q: 1.5 });
  },
  burstFire: (v) => {
    for (let i = 0; i < 4; i++) {
      noise(v, { filter: 'highpass', from: 1800, duration: 0.04, gain: 0.5, at: i * 0.06 });
      tone(v, { type: 'square', from: 260, to: 80, duration: 0.07, gain: 0.35, at: i * 0.06 });
    }
  },
  servo: (v) => {
    tone(v, { type: 'sawtooth', from: 110, to: 330, duration: 0.3, gain: 0.25 });
    clang(v, 400, 0.15, 0.2, 0.3);
    thud(v, 0.5, 0.3, 0.12);
  },
  vent: (v) => {
    noise(v, { filter: 'highpass', from: 1200, to: 4000, duration: 0.7, gain: 0.6 });
    thud(v, 0.8, 0, 0.3);
  },
  orbital: (v) => {
    // Falling from far above, then the strike.
    tone(v, { type: 'sine', from: 2800, to: 300, duration: 0.3, gain: 0.25 });
    thud(v, 1, 0.28, 0.6);
    noise(v, { from: 3000, to: 100, duration: 0.9, gain: 0.9, at: 0.28 });
    tone(v, { type: 'sawtooth', from: 1200, to: 80, duration: 0.5, gain: 0.2, at: 0.28 });
  },
  build: (v) => {
    for (let i = 0; i < 3; i++) clang(v, 900 + i * 200, 0.07, 0.14, i * 0.09);
    tone(v, { type: 'square', from: 660, to: 1320, duration: 0.12, gain: 0.12, at: 0.3 });
  },
  repair: (v) => {
    notes([784, 988, 1175], 0.08, 'square', 0.1).forEach((t) => tone(v, t));
    noise(v, { filter: 'highpass', from: 4000, duration: 0.25, gain: 0.12, attack: 0.05 });
  },
  zap: (v) => {
    tone(v, { type: 'sawtooth', from: 1800, to: 120, duration: 0.25, gain: 0.3 });
    for (let i = 0; i < 4; i++)
      noise(v, { filter: 'highpass', from: 3000, duration: 0.03, gain: 0.4, at: 0.05 + i * 0.05 });
    thud(v, 0.5, 0.04, 0.2);
  },
  overdrive: (v) => {
    tone(v, { type: 'sawtooth', from: 110, to: 660, duration: 0.7, gain: 0.3, attack: 0.1 });
    tone(v, { type: 'square', from: 220, to: 1320, duration: 0.7, gain: 0.12, attack: 0.1 });
    clang(v, 660, 0.6, 0.16, 0.65);
  },
  star: (v) => {
    notes([1568, 2093, 2637], 0.04, 'sine', 0.18).forEach((t) => tone(v, t));
    whoosh(v, 2500, 6000, 0.25, 0.25);
  },
  bind: (v) => {
    for (let i = 0; i < 4; i++) clang(v, 1400 - i * 150, 0.09, 0.1, i * 0.05);
    tone(v, { type: 'sine', from: 392, to: 262, duration: 0.4, gain: 0.25, at: 0.15 });
  },
  blink: (v) => {
    tone(v, { type: 'sine', from: 600, to: 2400, duration: 0.12, gain: 0.3 });
    tone(v, { type: 'sine', from: 2400, to: 700, duration: 0.16, gain: 0.25, at: 0.14 });
  },
  starfall: (v) => {
    for (let i = 0; i < 7; i++) {
      const at = i * 0.16;
      tone(v, { type: 'sine', from: 2600 - i * 90, to: 500, duration: 0.14, gain: 0.16, at });
      thud(v, 0.4, at + 0.12, 0.12);
    }
  },
  thunder: (v) => {
    noise(v, { filter: 'highpass', from: 2500, duration: 0.05, gain: 0.8 });
    tone(v, { type: 'sawtooth', from: 2200, to: 90, duration: 0.2, gain: 0.3 });
    noise(v, { from: 900, to: 70, duration: 0.9, gain: 0.9, at: 0.04 });
    thud(v, 0.8, 0.04, 0.4);
  },
  charge: (v) => {
    tone(v, { type: 'sawtooth', from: 180, to: 900, duration: 0.4, gain: 0.2, attack: 0.05 });
    for (let i = 0; i < 5; i++) noise(v, { filter: 'highpass', from: 3500, duration: 0.025, gain: 0.35, at: i * 0.07 });
  },
  roar: (v) => {
    for (const from of [98, 104, 147])
      tone(v, { type: 'sawtooth', from, to: from * 0.6, duration: 0.8, gain: 0.3, attack: 0.06 });
    noise(v, { filter: 'bandpass', from: 700, to: 300, duration: 0.8, gain: 0.7, attack: 0.06, q: 0.8 });
  },
  saw: (v) => {
    tone(v, { type: 'sawtooth', from: 320, to: 760, duration: 0.3, gain: 0.25 });
    noise(v, { filter: 'bandpass', from: 3500, to: 6000, duration: 0.3, gain: 0.4, q: 4 });
    clang(v, 1600, 0.1, 0.1, 0.15);
  },
  boost: (v) => {
    tone(v, { type: 'sawtooth', from: 140, to: 560, duration: 0.35, gain: 0.3, attack: 0.04 });
    whoosh(v, 600, 3500, 0.35, 0.4);
  },
  execute: (v) => {
    whoosh(v, 3000, 700, 0.1, 0.3);
    whoosh(v, 2000, 7000, 0.08, 0.6, 0.12);
    clang(v, 1700, 0.3, 0.16, 0.14);
    thud(v, 0.9, 0.14, 0.3);
  },
  /** An ability with no sound of its own. */
  cast: (v) => {
    whoosh(v, 600, 2400, 0.25, 0.5);
    tone(v, { type: 'sine', from: 330, to: 660, duration: 0.3, gain: 0.3 });
  },

  // The match.
  heroDeath: (v) => {
    tone(v, { type: 'sawtooth', from: 330, to: 55, duration: 0.7, gain: 0.35 });
    thud(v, 0.7, 0.05, 0.4);
  },
  /** The player's own hero took someone down. */
  kill: (v) => {
    thud(v, 0.6, 0, 0.2);
    notes([587, 880, 1175], 0.09, 'triangle', 0.35).forEach((t) => tone(v, t));
  },
  minionDeath: (v) => {
    tone(v, { type: 'triangle', from: 300, to: 90, duration: 0.12, gain: 0.25 });
    noise(v, { from: 1200, to: 200, duration: 0.1, gain: 0.25 });
  },
  structureDown: (v) => {
    noise(v, { from: 380, to: 60, duration: 0.9, gain: 1 });
    tone(v, { type: 'sine', from: 90, to: 30, duration: 0.9, gain: 0.8 });
    for (let i = 0; i < 4; i++) thud(v, 0.4, 0.15 + i * 0.17, 0.15);
  },
  gold: (v) => notes([1319, 1760], 0.06, 'sine', 0.3).forEach((t) => tone(v, t)),
  levelUp: (v) => notes([523, 659, 784, 1047], 0.08, 'triangle', 0.4).forEach((t) => tone(v, t)),
  // A horn call: two notes a fifth apart, each a stack of slightly detuned saws.
  matchStart: (v) => {
    for (const [from, at, duration] of [
      [147, 0, 0.5],
      [220, 0.45, 1.1],
    ]) {
      for (const detune of [0.995, 1, 1.006])
        tone(v, { type: 'sawtooth', from: from * detune, at, duration, gain: 0.16 });
    }
  },
  victory: (v) => notes([523, 659, 784, 1047, 1319], 0.14, 'triangle', 0.5).forEach((t) => tone(v, t)),
  defeat: (v) => notes([392, 330, 262, 196], 0.2, 'sawtooth', 0.3).forEach((t) => tone(v, t)),
};

/** A recording that plays for a cue, in place of or on top of the synthesised sound. */
interface Recorded {
  /** One is picked at random each time. */
  files: string[];
  gain: number;
  /** Playback speed; below 1 is lower and heavier. */
  rate?: number;
  /** How much of the synthesised sound still plays underneath, 0 to 1. */
  synth?: number;
  /** Seconds to wait, for a recording that belongs to the end of the sound. */
  delay?: number;
}

/**
 * Recorded sounds, from CC0 packs (see public/sounds/CREDITS.md). Weapons, hits and other physical
 * things are recordings; the synthesiser adds what the packs lack and gives each element its colour.
 */
const RECORDED: Partial<Record<SoundCue, Recorded>> = {
  swing: { files: ['blade_01', 'blade_02', 'blade_03'], gain: 0.9, synth: 0.3 },
  blade: { files: ['knifeSlice', 'knifeSlice2'], gain: 0.7, rate: 1.1 },
  claw: { files: ['chop', 'hit_02'], gain: 0.9, rate: 0.8, synth: 0.5 },
  magic: { files: ['spell_01', 'spell_02'], gain: 0.55, synth: 0.3 },
  gun: { files: ['shot_02'], gain: 0.7, rate: 1.1, synth: 0.3 },
  minionHit: { files: ['hit_03', 'hit_04'], gain: 0.5, rate: 1.2 },
  tower: { files: ['shot_01'], gain: 0.8, rate: 0.8, synth: 0.4 },
  impact: { files: ['hit_01', 'hit_02'], gain: 0.8, synth: 0.3 },
  guard: { files: ['clang_01'], gain: 0.5, synth: 0.7 },
  bash: { files: ['clang_02', 'clang_03'], gain: 0.8, synth: 0.6 },
  slam: { files: ['slam_01', 'slam_02'], gain: 1, synth: 0.6, delay: 0.16 },
  trap: { files: ['chain_01', 'chain_02'], gain: 0.7, synth: 0.4 },
  bind: { files: ['chain_02', 'chain_03'], gain: 0.7, synth: 0.6 },
  snipe: { files: ['shot_01'], gain: 0.9, synth: 0.6 },
  fire: { files: ['spell_fire_01', 'spell_fire_02', 'spell_fire_07'], gain: 0.9, synth: 0.4 },
  explosion: { files: ['explosion'], gain: 1, synth: 0.5, delay: 0.1 },
  firestorm: { files: ['spell_fire_03', 'spell_fire_04'], gain: 1, synth: 0.5 },
  earth: { files: ['stones_01', 'stones_02'], gain: 0.9, synth: 0.6 },
  stone: { files: ['stones_02'], gain: 0.8, rate: 0.7, synth: 0.5 },
  quake: { files: ['stones_03'], gain: 1, rate: 0.8, synth: 0.8 },
  roar: { files: ['creature_roar_02', 'creature_roar_03'], gain: 1, synth: 0.4 },
  stab: { files: ['knifeSlice'], gain: 0.8, synth: 0.5, delay: 0.08 },
  execute: { files: ['knifeSlice2'], gain: 0.9, rate: 0.85, synth: 0.7, delay: 0.1 },
  burstFire: { files: ['shot_01'], gain: 0.7, synth: 0.8 },
  servo: { files: ['machine_01'], gain: 0.8, synth: 0.5 },
  build: { files: ['tools_01', 'tools_02'], gain: 0.7, synth: 0.4 },
  orbital: { files: ['explosion'], gain: 1, rate: 0.7, synth: 1, delay: 0.28 },
  thunder: { files: ['explosion'], gain: 0.8, rate: 1.3, synth: 0.8 },
  saw: { files: ['clang_01'], gain: 0.35, rate: 1.5, synth: 1 },
  structureDown: { files: ['explosion'], gain: 1, rate: 0.6, synth: 1 },
  gold: { files: ['item_coins_01', 'item_coins_02'], gain: 0.5, synth: 0.5 },
};

const recordings = new Map<string, AudioBuffer>();
let recordingsRequested = false;

/** Fetches the recordings in the background. Until one arrives its cue plays synthesised only. */
function loadRecordings(c: AudioContext): void {
  if (recordingsRequested) return;
  recordingsRequested = true;
  const names = new Set(Object.values(RECORDED).flatMap((r) => r.files));
  for (const name of names) {
    fetch(`${import.meta.env.BASE_URL}sounds/${name}.mp3`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => recordings.set(name, buffer))
      .catch(() => {
        // Missing or not decodable here: that cue keeps its synthesised sound.
      });
  }
}

/** Plays one of a cue's recordings. False when none has loaded yet. */
function playRecorded(v: Voice, recorded: Recorded): boolean {
  const ready = recorded.files.filter((name) => recordings.has(name));
  if (ready.length === 0) return false;
  const source = v.c.createBufferSource();
  const gain = v.c.createGain();
  source.buffer = recordings.get(ready[Math.floor(Math.random() * ready.length)])!;
  source.playbackRate.value = (recorded.rate ?? 1) * v.pitch;
  gain.gain.value = recorded.gain * v.volume;
  source.connect(gain).connect(v.out);
  source.start(v.c.currentTime + (recorded.delay ?? 0));
  return true;
}

/** Tunes and signals keep their pitch; everything else varies a little each time. */
const FIXED_PITCH = new Set<SoundCue>(['gold', 'levelUp', 'matchStart', 'victory', 'defeat', 'kill', 'heal', 'dawn']);

/**
 * Plays a game sound. `pan` places it between the left (-1) and right (1) speaker, for something
 * that happened to one side of the player's hero.
 */
export function playCue(cue: SoundCue, volume = 1, pan = 0): void {
  if (muted || !ctx || !effects || ctx.state !== 'running') return;
  const last = lastPlayed.get(cue);
  const gap = CROWD_CUES.has(cue) ? CROWD_GAP_SECONDS : MIN_GAP_SECONDS;
  if (last !== undefined && ctx.currentTime - last < gap) return;
  lastPlayed.set(cue, ctx.currentTime);
  let out: AudioNode = effects;
  if (pan !== 0) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(effects);
    out = panner;
  }
  const pitch = FIXED_PITCH.has(cue) ? 1 : 0.92 + Math.random() * 0.16;
  const voice: Voice = { c: ctx, out, volume: Math.min(1, volume), pitch };
  const recorded = RECORDED[cue];
  if (recorded && playRecorded(voice, recorded)) {
    if (recorded.synth) CUES[cue]({ ...voice, volume: voice.volume * recorded.synth });
  } else CUES[cue](voice);
}
