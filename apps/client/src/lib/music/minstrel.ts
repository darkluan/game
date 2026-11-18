import { tr } from '@/i18n';
import { hz, type Melody, melodyByStep, type Theme, thump, voice } from './synth';

/**
 * "Khúc hát rong": the first lobby theme. Slow and calm, in D dorian: a drone, a frame drum,
 * a plucked lead and a flute that joins every other pass.
 */

const BPM = 92;
const STEP = 60 / BPM / 2; // one eighth note
const STEPS_PER_BAR = 8;

const MELODY: Melody = [
  ['D4', 2],
  ['A4', 2],
  ['G4', 1],
  ['A4', 1],
  ['F4', 1],
  ['E4', 1],
  ['D4', 2],
  ['F4', 1],
  ['G4', 1],
  ['A4', 4],
  ['C5', 2],
  ['B4', 1],
  ['A4', 1],
  ['G4', 2],
  ['A4', 1],
  ['B4', 1],
  ['A4', 3],
  ['G4', 1],
  ['E4', 4],
  ['F4', 2],
  ['A4', 2],
  ['D5', 2],
  ['C5', 1],
  ['A4', 1],
  ['B4', 2],
  ['G4', 2],
  ['A4', 4],
  ['G4', 1],
  ['A4', 1],
  ['F4', 2],
  ['E4', 1],
  ['F4', 1],
  ['D4', 2],
  ['E4', 2],
  ['C4', 2],
  ['D4', 4],
];
/** Bass note under each bar. */
const BASS = ['D2', 'D2', 'C2', 'A2', 'F2', 'G2', 'D2', 'C2'];
/** Frame drum, one bar: 'D' = low stroke, 't' = rim tap. */
const DRUM = ['D', '', 't', 'D', 'D', '', 't', 't'];

const melodyAt = melodyByStep(MELODY);
const LOOP_STEPS = BASS.length * STEPS_PER_BAR;

export const minstrel: Theme = {
  name: tr('Khúc hát rong'),
  stepSeconds: STEP,
  lowpass: 2400,
  fadeInSeconds: 1.5,
  level: 0.8,
  compress: false,
  schedule(ctx, out, step, at) {
    const inLoop = step % LOOP_STEPS;
    const pass = Math.floor(step / LOOP_STEPS);
    const beat = inLoop % STEPS_PER_BAR;
    const bass = hz(BASS[Math.floor(inLoop / STEPS_PER_BAR)]);

    if (beat === 0) {
      // Drone for the whole bar: root and fifth.
      for (const freq of [bass, bass * 1.5]) {
        voice(ctx, out, at, { type: 'sawtooth', freq, duration: STEP * STEPS_PER_BAR * 1.05, gain: 0.05, attack: 0.3 });
      }
    }
    if (beat === 0 || beat === 4) {
      voice(ctx, out, at, { type: 'triangle', freq: bass * 2, duration: 0.5, gain: 0.3, attack: 0.01 });
    }

    // The first pass is drone and melody only; the drum comes in from the second.
    const stroke = DRUM[beat];
    if (pass > 0 && stroke === 'D') thump(ctx, out, at, { from: 120, to: 48, drop: 0.18, gain: 0.9, decay: 0.3 });
    if (pass > 0 && stroke === 't') thump(ctx, out, at, { from: 330, to: 200, drop: 0.18, gain: 0.25, decay: 0.09 });

    const note = melodyAt.get(inLoop);
    if (!note) return;
    const freq = hz(note[0]);
    // Plucked lead, doubled an octave up very quietly for a lute-like shimmer.
    voice(ctx, out, at, {
      type: 'triangle',
      freq,
      duration: Math.max(0.35, note[1] * STEP * 0.9),
      gain: 0.32,
      attack: 0.008,
    });
    voice(ctx, out, at, { type: 'sine', freq: freq * 2, duration: 0.25, gain: 0.07, attack: 0.005 });
    // A flute takes the tune along on every other pass.
    if (pass % 2 === 1) {
      voice(ctx, out, at, {
        type: 'sine',
        freq: freq * 2,
        duration: note[1] * STEP,
        gain: 0.14,
        attack: 0.06,
        vibrato: 0.006,
      });
    }
  },
};
