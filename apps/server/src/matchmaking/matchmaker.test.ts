import { describe, expect, it } from 'vitest';
import { findMatch, type MatchSettings, rangeOf, splitTeams, type Ticket, ticketMmr } from './matchmaker.js';

const SETTINGS: MatchSettings = { rangeStart: 100, rangeStep: 50, rangeStepMs: 10_000, botFillMs: 75_000 };

let next = 0;
/** A ticket whose members have the given ratings. */
function ticket(mmrs: number[], joinedAt = 0): Ticket {
  const id = `t${next++}`;
  return { id, joinedAt, members: mmrs.map((mmr, i) => ({ playerId: `${id}-${i}`, mmr })) };
}
const solos = (mmrs: number[], joinedAt = 0) => mmrs.map((mmr) => ticket([mmr], joinedAt));
const mmrsOf = (team: Ticket[]) => team.flatMap((t) => t.members.map((m) => m.mmr)).sort((a, b) => a - b);

describe('range', () => {
  it('starts at 100 and grows by 50 every 10 seconds of waiting', () => {
    const t = ticket([0], 1000);
    expect(rangeOf(t, 1000, SETTINGS)).toBe(100);
    expect(rangeOf(t, 10_999, SETTINGS)).toBe(100);
    expect(rangeOf(t, 11_000, SETTINGS)).toBe(150);
    expect(rangeOf(t, 61_000, SETTINGS)).toBe(400);
  });
});

describe('splitTeams', () => {
  it('balances six solo players by average rating', () => {
    const split = splitTeams(solos([100, 90, 80, 70, 60, 50]))!;
    expect(split.bots).toEqual([0, 0]);
    expect(split.gap).toBeLessThanOrEqual(10 / 3 + 1e-9);
    expect(split.teams[0]).toHaveLength(3);
  });

  it('keeps a party together and counts it as stronger than its ratings', () => {
    const trio = ticket([50, 50, 50]);
    expect(ticketMmr(trio)).toBe(110);
    const split = splitTeams([trio, ...solos([50, 50, 50])])!;
    const partyTeam = split.teams.find((team) => team.includes(trio))!;
    expect(partyTeam).toEqual([trio]);
    expect(split.gap).toBe(60);
  });

  it('pairs a duo with the solo that evens the teams out', () => {
    // With its bonus the duo counts as 230 each, so the weakest solo that keeps the gap small joins it.
    const duo = ticket([200, 200]);
    const split = splitTeams([duo, ...solos([0, 300, 250, 150])])!;
    const withDuo = split.teams.find((team) => team.includes(duo))!;
    expect(mmrsOf(withDuo)).toEqual([150, 200, 200]);
  });

  it('refuses parties that cannot fit in two teams of three', () => {
    expect(splitTeams([ticket([0, 0]), ticket([0, 0]), ticket([0, 0])])).toBeNull();
    expect(splitTeams(solos([0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it('fills empty seats with bots, spreading the humans evenly', () => {
    const split = splitTeams(solos([40, 40]))!;
    expect(split.bots).toEqual([2, 2]);
    const alone = splitTeams(solos([40]))!;
    expect(alone.bots.sort()).toEqual([2, 3]);
  });
});

describe('findMatch', () => {
  it('needs six players within range before the bot-fill time', () => {
    const queue = solos([0, 10, 20, 30, 40]);
    expect(findMatch(queue, 5000, SETTINGS)).toBeNull();
    queue.push(ticket([50], 4000));
    const match = findMatch(queue, 5000, SETTINGS)!;
    expect(match.bots).toEqual([0, 0]);
    expect(match.teams.flat()).toHaveLength(6);
  });

  it('leaves a far-away player out until the range has grown to reach them', () => {
    const queue = [...solos([0, 0, 0, 0, 0]), ticket([240])];
    expect(findMatch(queue, 0, SETTINGS)).toBeNull();
    expect(findMatch(queue, 20_000, SETTINGS)).toBeNull(); // range 200
    expect(findMatch(queue, 30_000, SETTINGS)).not.toBeNull(); // range 250
  });

  it('serves the longest-waiting player first when there are more than six', () => {
    const early = solos([0, 0, 0, 0, 0, 0], 0);
    const late = solos([0, 0], 3000);
    const match = findMatch([...late, ...early], 5000, SETTINGS)!;
    const matched = new Set(match.teams.flat().map((t) => t.id));
    expect(early.every((t) => matched.has(t.id))).toBe(true);
  });

  it('skips a party that does not fit and takes the next players instead', () => {
    const queue = [...solos([0, 0, 0, 0, 0], 0), ticket([0, 0], 100), ticket([0], 200)];
    const match = findMatch(queue, 1000, SETTINGS)!;
    expect(match.teams.flat().every((t) => t.members.length === 1)).toBe(true);
  });

  it('fills with bots once a player has waited 75 seconds', () => {
    const queue = [ticket([0], 0), ticket([20], 60_000)];
    expect(findMatch(queue, 74_000, SETTINGS)).toBeNull();
    const match = findMatch(queue, 75_000, SETTINGS)!;
    expect(match.bots).toEqual([2, 2]);
    expect(match.teams.flat()).toHaveLength(2);
  });

  it('gives a lone player a bot match rather than no match', () => {
    const match = findMatch([ticket([500], 0)], 80_000, SETTINGS)!;
    expect(match.teams.flat()).toHaveLength(1);
    expect(match.bots[0] + match.bots[1]).toBe(5);
  });
});
