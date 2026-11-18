import type { HudState } from '@/lib/session';

/** Seconds as m:ss. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Kills of each side, the player's team first. */
export function teamKills(hud: HudState): [number, number] {
  const sum = (mine: boolean) =>
    hud.scores.filter((s) => (s.team === hud.team) === mine).reduce((n, s) => n + s.kills, 0);
  return [sum(true), sum(false)];
}
