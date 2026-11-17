/** Small WebAudio building blocks shared by the lobby themes. */

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A4' -> 440, 'Bb3', 'C#5'. */
export function hz(note: string): number {
  const accidental = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0;
  const octave = Number(note.slice(accidental === 0 ? 1 : 2));
  return 440 * 2 ** ((SEMITONE[note[0]] + accidental + 12 * (octave + 1) - 69) / 12);
}

/** A tune as [note or '-' for a rest, length in steps]. */
export type Melody = [string, number][];

/** Index a melody by the step each note starts on. */
export function melodyByStep(melody: Melody): Map<number, [string, number]> {
  const byStep = new Map<number, [string, number]>();
  melody.reduce((step, note) => (byStep.set(step, note), step + note[1]), 0);
  return byStep;
}

/** A piece of lobby music: how fast it steps and what to play on each step. */
export interface Theme {
  /** Shown in the menu. */
  name: string;
  /** Length of one sequencer step in seconds. */
  stepSeconds: number;
  /** Cutoff of the filter over the whole mix, in Hz: lower is mellower. */
  lowpass: number;
  fadeInSeconds: number;
  level: number;
  /** Squash the mix so a dense arrangement does not clip. */
  compress: boolean;
  schedule(ctx: AudioContext, out: AudioNode, step: number, at: number): void;
}

export interface Voice {
  type: OscillatorType;
  freq: number;
  duration: number;
  gain: number;
  attack: number;
  /** Hold near full level before releasing (winds, strings, brass); otherwise decay from the attack (plucks). */
  sustain?: boolean;
  /** Pitch wobble as a fraction of the frequency, growing in after the note starts. */
  vibrato?: number;
}

export function voice(ctx: AudioContext, out: AudioNode, at: number, o: Voice): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type;
  osc.frequency.value = o.freq;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(o.freq * o.vibrato, at + Math.min(0.25, o.duration));
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + o.duration);
  }
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(o.gain, at + o.attack);
  if (o.sustain) gain.gain.setValueAtTime(o.gain * 0.8, at + o.duration * 0.75);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + o.duration);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + o.duration);
}

let noiseBuffer: AudioBuffer | null = null;

/** A burst of filtered noise: shakers, snaps, breath. */
export function noise(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  duration: number,
  gainValue: number,
  highpass: number,
): void {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer;
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  gain.gain.setValueAtTime(gainValue, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
  source.stop(at + duration);
}

/** A pitched drum hit: a sine that drops from one frequency to another while it fades. */
export function thump(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  o: { from: number; to: number; drop: number; gain: number; decay: number },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(o.from, at);
  osc.frequency.exponentialRampToValueAtTime(o.to, at + o.drop);
  gain.gain.setValueAtTime(o.gain, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + o.decay);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + o.decay + 0.02);
}
