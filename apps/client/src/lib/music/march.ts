import { hz, type Melody, melodyByStep, noise, type Theme, thump, voice } from './synth';

/**
 * "Hành khúc": the second lobby theme. A fast heroic march in D dorian: brass carries the tune
 * in parallel fourths over galloping war drums and a driving bass.
 */

const BPM = 138;
const STEP = 60 / BPM / 2; // one eighth note
const STEPS_PER_BAR = 8;

/** A rising fifth as the call, then the answer. */
const MELODY: Melody = [
  ['D4', 1],
  ['D4', 1],
  ['A4', 2],
  ['A4', 1],
  ['G4', 1],
  ['A4', 2],
  ['C5', 2],
  ['A4', 1],
  ['G4', 1],
  ['A4', 4],
  ['D4', 1],
  ['D4', 1],
  ['A4', 2],
  ['A4', 1],
  ['C5', 1],
  ['D5', 2],
  ['E5', 2],
  ['D5', 1],
  ['C5', 1],
  ['D5', 4],
  ['F5', 2],
  ['E5', 1],
  ['D5', 1],
  ['C5', 2],
  ['A4', 2],
  ['C5', 2],
  ['D5', 1],
  ['C5', 1],
  ['A4', 2],
  ['G4', 2],
  ['F4', 1],
  ['G4', 1],
  ['A4', 2],
  ['C5', 1],
  ['A4', 1],
  ['G4', 2],
  ['A4', 2],
  ['E4', 2],
  ['D4', 4],
];
/** Bass note under each bar. */
const BASS = ['D2', 'C2', 'D2', 'D2', 'F2', 'C2', 'G2', 'A2'];
/** War drums, one bar, a gallop: 'D' = big low drum, 'd' = lighter stroke, 's' = snare tap. */
const DRUM = ['D', 's', 'd', 'd', 'D', 's', 'd', 'd'];

const melodyAt = melodyByStep(MELODY);
const LOOP_STEPS = BASS.length * STEPS_PER_BAR;

/** A brass section: detuned saws on the note and the octave below. */
function brass(ctx: AudioContext, out: AudioNode, at: number, freq: number, duration: number, gain: number): void {
  for (const detune of [0.994, 1, 1.007]) {
    voice(ctx, out, at, { type: 'sawtooth', freq: freq * detune, duration, gain, attack: 0.03, sustain: true });
  }
  voice(ctx, out, at, { type: 'sawtooth', freq: freq / 2, duration, gain: gain * 0.8, attack: 0.03, sustain: true });
}

export const march: Theme = {
  name: 'Hành khúc',
  stepSeconds: STEP,
  lowpass: 3200,
  fadeInSeconds: 0.4,
  level: 0.9,
  compress: true,
  schedule(ctx, out, step, at) {
    const inLoop = step % LOOP_STEPS;
    const pass = Math.floor(step / LOOP_STEPS);
    const beat = inLoop % STEPS_PER_BAR;
    const bass = hz(BASS[Math.floor(inLoop / STEPS_PER_BAR)]);

    const stroke = DRUM[beat];
    if (stroke === 's') noise(ctx, out, at, 0.08, 0.16, 20);
    else if (stroke === 'D') thump(ctx, out, at, { from: 130, to: 42, drop: 0.2, gain: 1, decay: 0.35 });
    else thump(ctx, out, at, { from: 170, to: 70, drop: 0.2, gain: 0.45, decay: 0.16 });

    // Driving bass on every eighth, jumping the octave on the off-beats.
    voice(ctx, out, at, {
      type: 'sawtooth',
      freq: beat % 2 === 0 ? bass : bass * 2,
      duration: STEP * 0.9,
      gain: 0.2,
      attack: 0.008,
    });
    if (beat === 0) {
      // Low brass holds the root and fifth through the bar.
      for (const freq of [bass * 2, bass * 3]) {
        voice(ctx, out, at, {
          type: 'sawtooth',
          freq,
          duration: STEP * STEPS_PER_BAR,
          gain: 0.045,
          attack: 0.05,
          sustain: true,
        });
      }
    }

    const note = melodyAt.get(inLoop);
    if (!note) return;
    const freq = hz(note[0]);
    const length = note[1] * STEP * 0.92;
    brass(ctx, out, at, freq, length, 0.085);
    // Second horns a fourth below on the longer notes: the open, medieval sound.
    if (note[1] >= 2) brass(ctx, out, at, freq * 0.75, length, 0.04);
    // From the second pass a bright plucked line doubles the tune an octave up.
    if (pass > 0) voice(ctx, out, at, { type: 'triangle', freq: freq * 2, duration: 0.3, gain: 0.14, attack: 0.005 });
  },
};
