import type { SoundCue } from './session';

/**
 * All game sounds are synthesised with WebAudio, so there are no audio files to load or license.
 * Each cue is a few oscillator or noise bursts.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const MASTER_GAIN = 0.35;
const lastPlayed = new Map<SoundCue, number>();
/** The same cue cannot retrigger faster than this, so a team fight does not turn into a buzz. */
const MIN_GAP_SECONDS = 0.05;

/** Browsers only allow audio after a user gesture: call this from a click handler. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(ctx.destination);
    }
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
}

function tone(c: AudioContext, out: AudioNode, volume: number, t: Tone): void {
  const start = c.currentTime + (t.at ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = t.type;
  osc.frequency.setValueAtTime(t.from, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.duration);
  gain.gain.setValueAtTime(t.gain * volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.duration);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + t.duration);
}

function noise(
  c: AudioContext,
  out: AudioNode,
  volume: number,
  duration: number,
  cutoff: number,
  gainValue: number,
): void {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(gainValue * volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  source.connect(filter).connect(gain).connect(out);
  source.start();
}

const notes = (freqs: number[], step: number, type: OscillatorType, gain: number): Tone[] =>
  freqs.map((from, i) => ({ type, from, at: i * step, duration: step * 1.8, gain }));

const CUES: Record<SoundCue, (c: AudioContext, out: AudioNode, v: number) => void> = {
  hit: (c, o, v) => {
    noise(c, o, v, 0.08, 2600, 0.5);
    tone(c, o, v, { type: 'triangle', from: 190, to: 90, duration: 0.09, gain: 0.5 });
  },
  tower: (c, o, v) => tone(c, o, v, { type: 'sawtooth', from: 520, to: 140, duration: 0.22, gain: 0.35 }),
  castQ: (c, o, v) => {
    noise(c, o, v, 0.28, 1400, 0.6);
    tone(c, o, v, { type: 'sawtooth', from: 140, to: 420, duration: 0.25, gain: 0.3 });
  },
  castW: (c, o, v) => {
    tone(c, o, v, { type: 'sine', from: 330, to: 660, duration: 0.35, gain: 0.45 });
    tone(c, o, v, { type: 'sine', from: 495, to: 990, duration: 0.35, gain: 0.25 });
  },
  castE: (c, o, v) => {
    noise(c, o, v, 0.12, 900, 0.9);
    tone(c, o, v, { type: 'square', from: 150, to: 60, duration: 0.16, gain: 0.45 });
  },
  castR: (c, o, v) => {
    noise(c, o, v, 0.5, 500, 1);
    tone(c, o, v, { type: 'sine', from: 110, to: 35, duration: 0.5, gain: 0.9 });
  },
  heroDeath: (c, o, v) => tone(c, o, v, { type: 'sawtooth', from: 330, to: 55, duration: 0.7, gain: 0.4 }),
  structureDown: (c, o, v) => {
    noise(c, o, v, 0.9, 380, 1);
    tone(c, o, v, { type: 'sine', from: 90, to: 30, duration: 0.9, gain: 0.8 });
  },
  gold: (c, o, v) => notes([1319, 1760], 0.06, 'sine', 0.3).forEach((t) => tone(c, o, v, t)),
  levelUp: (c, o, v) => notes([523, 659, 784, 1047], 0.08, 'triangle', 0.4).forEach((t) => tone(c, o, v, t)),
  // A horn call: two notes a fifth apart, each a stack of slightly detuned saws.
  matchStart: (c, o, v) => {
    for (const [from, at, duration] of [
      [147, 0, 0.5],
      [220, 0.45, 1.1],
    ]) {
      for (const detune of [0.995, 1, 1.006])
        tone(c, o, v, { type: 'sawtooth', from: from * detune, at, duration, gain: 0.16 });
    }
  },
  victory: (c, o, v) => notes([523, 659, 784, 1047, 1319], 0.14, 'triangle', 0.5).forEach((t) => tone(c, o, v, t)),
  defeat: (c, o, v) => notes([392, 330, 262, 196], 0.2, 'sawtooth', 0.3).forEach((t) => tone(c, o, v, t)),
};

export function playCue(cue: SoundCue, volume = 1): void {
  if (muted || !ctx || !master || ctx.state !== 'running') return;
  const last = lastPlayed.get(cue);
  if (last !== undefined && ctx.currentTime - last < MIN_GAP_SECONDS) return;
  lastPlayed.set(cue, ctx.currentTime);
  CUES[cue](ctx, master, Math.min(1, volume));
}
