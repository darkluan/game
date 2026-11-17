import { audioOutput } from '../audio';
import { festival } from './festival';
import { march } from './march';
import { minstrel } from './minstrel';

/**
 * Lobby music. Every theme is original and synthesised with WebAudio, so there are no audio files.
 * A tiny sequencer steps through the chosen theme.
 */
export const THEMES = { minstrel, march, festival } as const;
export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'minstrel';

const LOOKAHEAD = 0.25;

let timer: number | undefined;
let bus: GainNode | null = null;

/** Starts a lobby theme. Does nothing until audio has been unlocked by a user gesture. */
export function startMusic(id: ThemeId): void {
  const audio = audioOutput();
  if (!audio || timer !== undefined) return;
  const { ctx, out } = audio;
  const theme = THEMES[id];
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = theme.lowpass;
  const target = ctx.createGain();
  target.gain.setValueAtTime(0.0001, ctx.currentTime);
  target.gain.exponentialRampToValueAtTime(theme.level, ctx.currentTime + theme.fadeInSeconds);
  if (theme.compress) target.connect(lowpass).connect(ctx.createDynamicsCompressor()).connect(out);
  else target.connect(lowpass).connect(out);
  bus = target;

  let step = 0;
  let time = ctx.currentTime + 0.1;
  timer = window.setInterval(() => {
    // Schedule a little ahead of the clock so timing does not depend on timer jitter.
    while (time < ctx.currentTime + LOOKAHEAD) {
      theme.schedule(ctx, target, step++, time);
      time += theme.stepSeconds;
    }
  }, 60);
}

/** Fades the music out, e.g. when a match begins or another theme is chosen. */
export function stopMusic(): void {
  const audio = audioOutput();
  if (timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
  if (audio && bus) {
    const old = bus;
    old.gain.cancelScheduledValues(audio.ctx.currentTime);
    old.gain.setValueAtTime(old.gain.value, audio.ctx.currentTime);
    old.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.6);
    window.setTimeout(() => old.disconnect(), 800);
  }
  bus = null;
}
