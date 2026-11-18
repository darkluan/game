import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../db/memoryStore.js';
import { DEFAULT_RATING } from './rating.js';
import { type FinishedMatch, type FinishedPlayer, penalizeLeaver, recordMatch } from './results.js';

const player = (playerId: string, team: 0 | 1, leftEarly = false): FinishedPlayer => ({
  playerId,
  team,
  heroId: 'kael',
  kills: 1,
  deaths: 2,
  assists: 3,
  leftEarly,
});

const finished = (players: FinishedPlayer[], mode: 'ranked' | 'private' = 'ranked'): FinishedMatch => ({
  mode,
  startedAt: new Date(),
  durationS: 500,
  winner: 0,
  teamSize: 3,
  players,
});

const six = () => [player('a', 0), player('b', 0), player('c', 0), player('d', 1), player('e', 1), player('f', 1)];

describe('recordMatch', () => {
  it('rates a full ranked match: winners up, losers down, history saved', async () => {
    const store = new MemoryStore();
    const outcome = await recordMatch(store, finished(six()));
    expect(outcome.get('a')!.mmrAfter).toBeGreaterThan(outcome.get('a')!.mmrBefore);
    expect(outcome.get('d')!.mmrAfter).toBeLessThan(outcome.get('a')!.mmrAfter);
    expect((await store.getPlayer('a'))!.mu).toBeGreaterThan(DEFAULT_RATING.mu);
    expect((await store.getPlayer('d'))!.mu).toBeLessThan(DEFAULT_RATING.mu);
    expect((await store.getPlayer('a'))!.gamesPlayed).toBe(1);
    const history = await store.listMatches('d', 1, 10);
    expect(history.data[0]).toMatchObject({ mode: 'ranked', won: false, kills: 1, deaths: 2, assists: 3 });
  });

  it('moves ratings half as much when bots filled seats', async () => {
    const full = await recordMatch(new MemoryStore(), finished(six()));
    const withBots = await recordMatch(new MemoryStore(), finished([player('a', 0), player('d', 1)]));
    const gain = (o: typeof full) => o.get('a')!.mmrAfter - o.get('a')!.mmrBefore;
    expect(gain(withBots)).toBeGreaterThan(0);
    expect(gain(withBots)).toBeLessThan(gain(full) * 0.7);
  });

  it('saves a private match without changing any rating', async () => {
    const store = new MemoryStore();
    const outcome = await recordMatch(store, finished(six(), 'private'));
    expect(outcome.get('a')).toEqual({ mmrBefore: 0, mmrAfter: 0 });
    expect(await store.getPlayer('a')).toMatchObject({ mu: DEFAULT_RATING.mu, gamesPlayed: 0 });
    expect((await store.listMatches('a', 1, 10)).total).toBe(1);
  });

  it('bans a player who left a ranked match, but not one who left a private match', async () => {
    const store = new MemoryStore();
    const now = new Date();
    await recordMatch(store, finished([player('a', 0, true), player('d', 1)], 'private'));
    expect(await store.penaltyUntil('a', now)).toBeNull();
    await recordMatch(store, finished([player('a', 0, true), player('d', 1)]));
    expect(await store.penaltyUntil('a', now)).not.toBeNull();
    expect(await store.penaltyUntil('d', now)).toBeNull();
  });
});

describe('penalizeLeaver', () => {
  it('escalates within a day: 5 minutes, 15 minutes, then an hour', async () => {
    const store = new MemoryStore();
    await store.ensurePlayer('a');
    const now = new Date();
    const minutes = async () =>
      Math.round(((await penalizeLeaver(store, 'a', now)).getTime() - now.getTime()) / 60_000);
    expect(await minutes()).toBe(5);
    expect(await minutes()).toBe(15);
    expect(await minutes()).toBe(60);
    expect(await minutes()).toBe(60);
  });
});
