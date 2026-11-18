import { rate, rating } from 'openskill';

export interface Rating {
  mu: number;
  sigma: number;
}

/** What a new player starts with (OpenSkill's defaults: mu 25, sigma 25/3). */
export const DEFAULT_RATING: Rating = rating();

/**
 * Matchmaking rating: the conservative estimate `mu - 3 * sigma`, scaled so that the queue's
 * ranges (100, +50 per step) are a sensible size. A new player starts at 0.
 */
const MMR_SCALE = 40;
export const mmrOf = (r: Rating): number => Math.round((r.mu - 3 * r.sigma) * MMR_SCALE);

/** Matches with bots count for less. */
export const BOT_MATCH_FACTOR = 0.5;

/**
 * New ratings after a match. `teams` holds the players' ratings by team; `factor` below 1 shrinks
 * every change (used when bots took part).
 */
export function rateMatch(teams: [Rating[], Rating[]], winner: 0 | 1, factor = 1): [Rating[], Rating[]] {
  const rated = rate(teams, { rank: winner === 0 ? [1, 2] : [2, 1] });
  const blend = (before: Rating, after: Rating): Rating => ({
    mu: before.mu + (after.mu - before.mu) * factor,
    sigma: before.sigma + (after.sigma - before.sigma) * factor,
  });
  return [teams[0].map((r, i) => blend(r, rated[0][i])), teams[1].map((r, i) => blend(r, rated[1][i]))];
}
