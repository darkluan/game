import { describe, expect, it } from 'vitest';
import { BOT_MATCH_FACTOR, DEFAULT_RATING, mmrOf, rateMatch, type Rating } from './rating.js';

const fresh = (n: number): Rating[] => Array.from({ length: n }, () => ({ ...DEFAULT_RATING }));

describe('ratings', () => {
  it('start a new player at 0 MMR', () => {
    expect(mmrOf(DEFAULT_RATING)).toBe(0);
  });

  it('raise the winners and lower the losers, and make both more certain', () => {
    const [winners, losers] = rateMatch([fresh(3), fresh(3)], 0);
    expect(winners.every((r) => r.mu > DEFAULT_RATING.mu && r.sigma < DEFAULT_RATING.sigma)).toBe(true);
    expect(losers.every((r) => r.mu < DEFAULT_RATING.mu && r.sigma < DEFAULT_RATING.sigma)).toBe(true);
    expect(mmrOf(winners[0])).toBeGreaterThan(mmrOf(losers[0]));
    const [l2, w2] = rateMatch([fresh(3), fresh(3)], 1);
    expect(w2[0].mu).toBeCloseTo(winners[0].mu);
    expect(l2[0].mu).toBeCloseTo(losers[0].mu);
  });

  it('move a new player fast and a settled player slowly', () => {
    const settled: Rating = { mu: 25, sigma: 2 };
    const [[newcomer], [veteran]] = rateMatch([[{ ...DEFAULT_RATING }], [settled]], 0);
    expect(newcomer.mu - DEFAULT_RATING.mu).toBeGreaterThan((settled.mu - veteran.mu) * 3);
  });

  it('change half as much in a match with bots', () => {
    const [[full]] = rateMatch([fresh(3), fresh(3)], 0);
    const [[half]] = rateMatch([fresh(3), fresh(3)], 0, BOT_MATCH_FACTOR);
    expect(half.mu - DEFAULT_RATING.mu).toBeCloseTo((full.mu - DEFAULT_RATING.mu) / 2);
    expect(DEFAULT_RATING.sigma - half.sigma).toBeCloseTo((DEFAULT_RATING.sigma - full.sigma) / 2);
  });
});
