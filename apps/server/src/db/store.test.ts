import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RATING } from '../matchmaking/rating.js';
import { MemoryStore } from './memoryStore.js';
import { migrate } from './migrate.js';
import { PgStore } from './pgStore.js';
import type { MatchRecord, Store } from './store.js';

/**
 * The same contract for both stores. The PostgreSQL half runs only when TEST_DATABASE_URL points at
 * a database that may be wiped, e.g. `docker compose up -d postgres` and
 * TEST_DATABASE_URL=postgres://moba:moba@localhost:5432/moba
 */
const testUrl = process.env.TEST_DATABASE_URL;
const backends: [string, () => Promise<Store>][] = [['memory', async () => new MemoryStore()]];
if (testUrl) {
  backends.push([
    'postgres',
    async () => {
      const pool = new pg.Pool({ connectionString: testUrl });
      await pool.query('DROP TABLE IF EXISTS penalties, match_players, matches, players, schema_migrations CASCADE');
      await migrate(pool);
      await migrate(pool); // running again changes nothing
      return new PgStore(pool);
    },
  ]);
}

function match(
  players: { id: string; team: 0 | 1; mu: number }[],
  mode: 'ranked' | 'private',
  at: number,
): MatchRecord {
  return {
    id: randomUUID(),
    mode,
    startedAt: new Date(at),
    durationS: 600,
    winnerTeam: 0,
    hadBots: false,
    players: players.map((p) => ({
      playerId: p.id,
      team: p.team,
      heroId: 'kael',
      kills: 3,
      deaths: 1,
      assists: 2,
      before: { ...DEFAULT_RATING },
      after: { mu: p.mu, sigma: 7 },
      leftEarly: false,
    })),
  };
}

describe.each(backends)('%s store', (_name, open) => {
  let store: Store;
  beforeAll(async () => {
    store = await open();
  });
  afterAll(async () => {
    await store.close();
  });

  it('creates a player once with the starting rating', async () => {
    const id = randomUUID();
    expect(await store.getPlayer(id)).toBeNull();
    const created = await store.ensurePlayer(id);
    expect(created).toMatchObject({ id, googleId: null, nickname: '', gamesPlayed: 0, mu: DEFAULT_RATING.mu });
    await store.setNickname(id, 'Lan');
    expect(await store.ensurePlayer(id)).toMatchObject({ id, nickname: 'Lan' });
  });

  it('links a Google account to one player only', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const googleId = `g-${randomUUID()}`;
    await store.ensurePlayer(a);
    await store.ensurePlayer(b);
    expect(await store.findByGoogleId(googleId)).toBeNull();
    await store.linkGoogle(a, googleId);
    expect((await store.findByGoogleId(googleId))?.id).toBe(a);
    await expect(store.linkGoogle(b, googleId)).rejects.toThrow();
    expect((await store.getPlayer(b))?.googleId).toBeNull();
  });

  it('saves a ranked match with the new ratings, and a private one without touching them', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    await store.ensurePlayer(a);
    await store.ensurePlayer(b);
    await store.saveMatch(
      match(
        [
          { id: a, team: 0, mu: 27 },
          { id: b, team: 1, mu: 23 },
        ],
        'ranked',
        1000,
      ),
    );
    expect(await store.getPlayer(a)).toMatchObject({ mu: 27, sigma: 7, gamesPlayed: 1 });
    expect(await store.getPlayer(b)).toMatchObject({ mu: 23, gamesPlayed: 1 });
    await store.saveMatch(match([{ id: a, team: 1, mu: 99 }], 'private', 2000));
    expect(await store.getPlayer(a)).toMatchObject({ mu: 27, gamesPlayed: 1 });

    const history = await store.listMatches(a, 1, 10);
    expect(history.total).toBe(2);
    expect(history.data.map((m) => [m.mode, m.won])).toEqual([
      ['private', false],
      ['ranked', true],
    ]);
    expect(history.data[1]).toMatchObject({ heroId: 'kael', kills: 3, deaths: 1, assists: 2, muAfter: 27 });
    const second = await store.listMatches(a, 2, 1);
    expect(second.data).toHaveLength(1);
    expect(second.data[0].mode).toBe('ranked');
  });

  it('saves a match completely or not at all', async () => {
    const a = randomUUID();
    await store.ensurePlayer(a);
    const broken = match(
      [
        { id: a, team: 0, mu: 30 },
        { id: randomUUID(), team: 1, mu: 20 },
      ],
      'ranked',
      3000,
    );
    if (store.persistent) {
      // The second player does not exist, so the insert fails part-way.
      await expect(store.saveMatch(broken)).rejects.toThrow();
      expect(await store.getPlayer(a)).toMatchObject({ mu: DEFAULT_RATING.mu, gamesPlayed: 0 });
      expect((await store.listMatches(a, 1, 10)).total).toBe(0);
    }
  });

  it('tracks queue bans: the longest active one counts, expired ones do not', async () => {
    const a = randomUUID();
    await store.ensurePlayer(a);
    const now = new Date();
    expect(await store.penaltyUntil(a, now)).toBeNull();
    await store.addPenalty(a, 'left_match', new Date(now.getTime() - 1000));
    expect(await store.penaltyUntil(a, now)).toBeNull();
    const until = new Date(now.getTime() + 5 * 60_000);
    await store.addPenalty(a, 'left_match', until);
    await store.addPenalty(a, 'left_match', new Date(now.getTime() + 60_000));
    expect((await store.penaltyUntil(a, now))?.getTime()).toBe(until.getTime());
    expect(await store.countPenaltiesSince(a, new Date(now.getTime() - 60_000))).toBe(3);
    expect(await store.countPenaltiesSince(a, new Date(now.getTime() + 60_000))).toBe(0);
  });
});
