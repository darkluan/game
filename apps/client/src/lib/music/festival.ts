import { hz, type Melody, melodyByStep, noise, type Theme, thump, voice } from './synth';

/**
 * "Trống hội": the third lobby theme. Folk-fusion in D minor: a syncopated hand-percussion groove,
 * a bouncing bass, string stabs and a pan flute carrying the tune.
 */

const BPM = 112;
const STEP = 60 / BPM / 4; // one sixteenth note
const STEPS_PER_BAR = 16;
/** Percussion and bass alone before the tune comes in. */
const INTRO_STEPS = STEPS_PER_BAR * 2;

const MELODY: Melody = [
  ['D5', 3],
  ['F5', 3],
  ['E5', 2],
  ['D5', 4],
  ['A4', 4],
  ['D5', 3],
  ['F5', 3],
  ['G5', 2],
  ['A5', 6],
  ['-', 2],
  ['Bb5', 3],
  ['A5', 3],
  ['G5', 2],
  ['F5', 4],
  ['D5', 4],
  ['E5', 3],
  ['G5', 3],
  ['E5', 2],
  ['C5', 6],
  ['-', 2],
  ['D5', 2],
  ['E5', 2],
  ['F5', 4],
  ['A5', 3],
  ['G5', 3],
  ['F5', 2],
  ['F5', 3],
  ['A5', 3],
  ['C6', 2],
  ['A5', 6],
  ['-', 2],
  ['G5', 3],
  ['Bb5', 3],
  ['A5', 2],
  ['G5', 4],
  ['F5', 4],
  ['E5', 4],
  ['C#5', 4],
  ['E5', 4],
  ['A4', 4],
];
/** The chord under each bar, root first. */
const CHORDS = [
  ['D3', 'F3', 'A3'],
  ['D3', 'F3', 'A3'],
  ['Bb2', 'D3', 'F3'],
  ['C3', 'E3', 'G3'],
  ['D3', 'F3', 'A3'],
  ['F3', 'A3', 'C4'],
  ['G3', 'Bb3', 'D4'],
  ['A2', 'C#3', 'E3'],
].map((chord) => chord.map(hz));

/**
 * One bar of percussion in sixteenths. 'D' = deep drum, 't' = hand drum, 's' = rim snap.
 * The deep drum avoids beats 2 and 4 so the groove leans forward.
 */
const DRUM = ['D', '', '', 't', 's', '', 'D', 't', '', '', 'D', '', 's', '', 't', 't'];
/** Bar-ending fill, replacing the last beat every fourth bar. */
const FILL = ['t', 't', 'D', 'D'];
/** Bass line as [step in the bar, chord degree]: 0 root, 1 octave, 2 fifth. */
const BASS_LINE: [number, number][] = [
  [0, 0],
  [3, 0],
  [6, 1],
  [8, 0],
  [11, 2],
  [14, 1],
];
/** Where the strings stab the chord. */
const STABS = [0, 6, 11];

const melodyAt = melodyByStep(MELODY);
const LOOP_STEPS = CHORDS.length * STEPS_PER_BAR;

/** Pan flute: a soft tone with a puff of breath at the start. */
function flute(ctx: AudioContext, out: AudioNode, at: number, freq: number, duration: number): void {
  voice(ctx, out, at, { type: 'triangle', freq, duration, gain: 0.3, attack: 0.03, sustain: true, vibrato: 0.008 });
  voice(ctx, out, at, { type: 'sine', freq: freq * 2, duration, gain: 0.06, attack: 0.03, sustain: true });
  noise(ctx, out, at, 0.06, 0.08, 3000);
}

export const festival: Theme = {
  name: 'Trống hội',
  stepSeconds: STEP,
  lowpass: 5200,
  fadeInSeconds: 0.4,
  level: 0.9,
  compress: true,
  schedule(ctx, out, step, at) {
    const intro = step < INTRO_STEPS;
    const inLoop = intro ? step : (step - INTRO_STEPS) % LOOP_STEPS;
    const pass = intro ? -1 : Math.floor((step - INTRO_STEPS) / LOOP_STEPS);
    const bar = Math.floor(inLoop / STEPS_PER_BAR);
    const beat = inLoop % STEPS_PER_BAR;
    const chord = CHORDS[intro ? 0 : bar];

    // Percussion: the groove, a shaker on every sixteenth, and a fill closing every fourth bar.
    const fill = bar % 4 === 3 && beat >= 12 ? FILL[beat - 12] : undefined;
    const stroke = fill ?? DRUM[beat];
    if (stroke === 's') noise(ctx, out, at, 0.07, 0.3, 1800);
    else if (stroke === 'D') thump(ctx, out, at, { from: 140, to: 45, drop: 0.2, gain: 1, decay: 0.3 });
    else if (stroke === 't') thump(ctx, out, at, { from: 300, to: 180, drop: 0.08, gain: 0.4, decay: 0.12 });
    noise(ctx, out, at, 0.03, beat % 4 === 2 ? 0.09 : 0.04, 6000);

    const bass = BASS_LINE.find(([at16]) => at16 === beat);
    if (bass) {
      const freq = (chord[0] / 2) * [1, 2, 1.5][bass[1]];
      voice(ctx, out, at, { type: 'sawtooth', freq, duration: STEP * 2.4, gain: 0.26, attack: 0.008 });
      voice(ctx, out, at, { type: 'sine', freq, duration: STEP * 2.4, gain: 0.3, attack: 0.008 });
    }
    if (intro) return;

    if (STABS.includes(beat)) {
      for (const freq of chord) {
        for (const detune of [0.996, 1.004]) {
          voice(ctx, out, at, {
            type: 'sawtooth',
            freq: freq * 2 * detune,
            duration: STEP * 2.6,
            gain: 0.035,
            attack: 0.01,
          });
        }
      }
    }
    if (beat === 0) {
      // A soft held chord under everything, like a distant choir.
      for (const freq of chord) {
        voice(ctx, out, at, {
          type: 'triangle',
          freq,
          duration: STEP * STEPS_PER_BAR,
          gain: 0.05,
          attack: 0.2,
          sustain: true,
        });
      }
    }

    const note = melodyAt.get(inLoop);
    if (!note || note[0] === '-') return;
    const freq = hz(note[0]);
    const length = note[1] * STEP * 0.95;
    flute(ctx, out, at, freq, length);
    // From the second pass, strings double the tune an octave below.
    if (pass > 0) {
      for (const detune of [0.995, 1.005]) {
        voice(ctx, out, at, {
          type: 'sawtooth',
          freq: (freq / 2) * detune,
          duration: length,
          gain: 0.05,
          attack: 0.04,
          sustain: true,
        });
      }
    }
  },
};
