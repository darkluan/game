import { Client, type Room } from '@colyseus/sdk';
import type { MatchResult, MatchWelcome, Profile, QueueStatus, Sim } from '@game/core';
import { matchMaker } from 'colyseus';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer } from '../app.js';
import { InvalidGoogleCredential } from '../auth/google.js';
import { getStore } from '../db/index.js';

/**
 * Real server, real clients: accounts over HTTP and the ranked queue over WebSocket.
 * Matchmaking timers are shortened in vitest.config.ts (bot fill, accept and draft: 2 seconds each).
 */

const PORT = 2595;
const URL = `http://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Stands in for Google: "good:<account>" is a valid credential for that account. */
const server = createGameServer(async (credential) => {
  if (!credential.startsWith('good:')) throw new InvalidGoogleCredential('bad');
  return credential.slice(5);
});

interface Guest {
  playerId: string;
  token: string;
}

async function guest(): Promise<Guest> {
  return (await (await fetch(`${URL}/v1/guests`, { method: 'POST' })).json()) as Guest;
}

const authed = (token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
});

/** Join the queue room and keep the latest status. `until` waits for a state to be reached. */
async function inQueue(g: Guest, nickname: string) {
  const room: Room = await new Client(URL).joinOrCreate('queue', { token: g.token, nickname });
  let latest: QueueStatus | undefined;
  const notices: string[] = [];
  room.onMessage('queue', (s: QueueStatus) => {
    latest = s;
    if (s.notice) notices.push(s.notice);
  });
  await sleep(150);
  const until = async (state: QueueStatus['state'], timeoutMs = 6000): Promise<QueueStatus> => {
    const deadline = Date.now() + timeoutMs;
    while (latest?.state !== state) {
      if (Date.now() > deadline) throw new Error(`${nickname} never reached "${state}" (last: ${latest?.state})`);
      await sleep(50);
    }
    return latest;
  };
  return {
    room,
    status: () => latest!,
    notices,
    until,
    send: (type: string, payload?: unknown) => room.send(type, payload),
  };
}

beforeAll(async () => {
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

describe('accounts', () => {
  it('reports what the server offers', async () => {
    const body = await (await fetch(`${URL}/v1/config`)).json();
    expect(body).toEqual({ ranked: true, googleClientId: 'test-client-id' });
  });

  it('returns the profile of the token holder, and 401 without a valid token', async () => {
    const g = await guest();
    const me = (await (await fetch(`${URL}/v1/me`, authed(g.token))).json()) as Profile;
    expect(me).toEqual({
      playerId: g.playerId,
      nickname: '',
      mmr: 0,
      gamesPlayed: 0,
      google: false,
      penaltyUntil: null,
    });

    for (const init of [{}, authed('forged.token')]) {
      const res = await fetch(`${URL}/v1/me`, init);
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain('invalid_token');
      expect(await res.json()).toMatchObject({ code: 401, reason: 'invalid_token', path: '/v1/me' });
    }
  });

  it('pages match history with a bounded page size', async () => {
    const g = await guest();
    const res = await fetch(`${URL}/v1/me/matches?limit=9999&page=abc`, authed(g.token));
    expect(await res.json()).toEqual({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  });

  it('attaches a Google account to a guest, then opens that account from another device', async () => {
    const first = await guest();
    const account = `acct-${first.playerId}`;
    const signIn = (g: Guest, credential: unknown) =>
      fetch(`${URL}/v1/auth/google`, authed(g.token, { method: 'POST', body: JSON.stringify({ credential }) }));

    const linked = (await (await signIn(first, `good:${account}`)).json()) as { token: string; profile: Profile };
    expect(linked.profile).toMatchObject({ playerId: first.playerId, google: true });
    expect(linked.token).toBe(first.token);

    const otherDevice = await guest();
    const opened = (await (await signIn(otherDevice, `good:${account}`)).json()) as { token: string; profile: Profile };
    expect(opened.profile.playerId).toBe(first.playerId);
    expect(opened.token).toBe(first.token);

    // A guest already tied to one Google account is not taken over by a second one.
    const second = (await (await signIn(first, 'good:someone-else')).json()) as { profile: Profile };
    expect(second.profile.playerId).not.toBe(first.playerId);

    expect((await signIn(first, 'forged')).status).toBe(401);
    expect((await signIn(first, undefined)).status).toBe(400);
    expect((await signIn(first, 'x'.repeat(5000))).status).toBe(400);
  });
});

describe('ranked queue', () => {
  it('gives a lone player a bot match: search, accept, draft, then a ranked match room', async () => {
    const g = await guest();
    const me = await inQueue(g, 'Lan');
    expect(me.status()).toMatchObject({ state: 'idle', mmr: 0, party: null, penaltySeconds: 0 });

    me.send('find', 'sola');
    const searching = await me.until('searching');
    expect(searching.searching).toMatchObject({ range: 100, botFillSeconds: 2 });

    const found = await me.until('accept');
    expect(found.accept).toMatchObject({ accepted: 0, total: 1, youAccepted: false });
    me.send('accept');

    const draft = await me.until('draft');
    expect(draft.draft).toMatchObject({ bots: 5, picks: [{ nickname: 'Lan', heroId: 'sola', isYou: true }] });
    me.send('hero', 'vesper');
    me.send('hero', 'not-a-hero');
    await sleep(150);
    expect(me.status().draft!.picks[0].heroId).toBe('vesper');
    me.send('ready');

    const starting = await me.until('starting');
    const match = await new Client(URL).joinById(starting.matchRoomId!, { token: g.token });
    const welcome = await new Promise<MatchWelcome>((resolve) => match.onMessage('welcome', resolve));
    match.onMessage('s', () => {});
    expect(welcome.mode).toBe('ranked');
    expect(welcome.code).toBe('');
    expect(welcome.roster.filter((r) => r.isBot)).toHaveLength(5);
    expect(welcome.roster.find((r) => r.heroId === welcome.heroId)).toMatchObject({
      heroDefId: 'vesper',
      nickname: 'Lan',
    });

    // Decide the match on the server (as if my team had destroyed the enemy base) and check that it
    // is rated and saved.
    const result = new Promise<MatchResult>((resolve) => match.onMessage('result', resolve));
    const { sim } = matchMaker.getLocalRoomById(starting.matchRoomId!) as unknown as { sim: Sim };
    const myTeam = sim.heroOf(g.playerId)!.team;
    for (let pass = 0; pass < 3; pass++) {
      for (const e of [...sim.world.entities]) {
        if (e.team !== myTeam && (e.tower || e.shrine)) sim.dealDamage(e, 1e7, null);
      }
    }
    const outcome = await result;
    expect(outcome.mmrBefore).toBe(0);
    expect(outcome.mmrAfter).toBeGreaterThan(0);
    const saved = await getStore().listMatches(g.playerId, 1, 10);
    expect(saved.data).toMatchObject([{ mode: 'ranked', won: true, heroId: 'vesper' }]);
    expect(await getStore().getPlayer(g.playerId)).toMatchObject({ gamesPlayed: 1, nickname: 'Lan' });
    const profile = (await (await fetch(`${URL}/v1/me`, authed(g.token))).json()) as Profile;
    expect(profile).toMatchObject({ mmr: outcome.mmrAfter, gamesPlayed: 1, penaltyUntil: null });
    await match.leave();
    await me.room.leave();
  }, 15_000);

  it('drops a player who does not accept in time', async () => {
    const me = await inQueue(await guest(), 'Lan');
    me.send('find');
    await me.until('accept');
    await me.until('idle');
    expect(me.notices.at(-1)).toContain('không chấp nhận');
    await me.room.leave();
  }, 15_000);

  it('puts two strangers on opposite teams, and returns the one who accepted to the queue when the other declines', async () => {
    const a = await inQueue(await guest(), 'An');
    const b = await inQueue(await guest(), 'Bình');
    a.send('find');
    await sleep(300);
    b.send('find');
    const [foundA] = await Promise.all([a.until('accept'), b.until('accept')]);
    expect(foundA.accept!.total).toBe(2);

    a.send('accept');
    await sleep(200);
    expect(b.status().accept).toMatchObject({ accepted: 1, total: 2, youAccepted: false });
    b.send('decline');
    await b.until('idle');
    const back = await a.until('searching');
    expect(back.searching!.waitedSeconds).toBeGreaterThanOrEqual(2); // kept its place in line
    expect(a.notices.at(-1)).toContain('đầu hàng chờ');

    // Alone again, A is matched with bots; this time accept and check the teams of a 2-player match.
    b.send('find');
    await Promise.all([a.until('accept'), b.until('accept')]);
    a.send('accept');
    b.send('accept');
    const [draftA, draftB] = await Promise.all([a.until('draft'), b.until('draft')]);
    expect(draftA.draft!.team).not.toBe(draftB.draft!.team);
    expect(draftA.draft!.picks).toHaveLength(1); // only teammates are listed
    await a.room.leave();
    await b.room.leave();
  }, 20_000);

  it('keeps a party together: only the leader searches, and both land on the same team', async () => {
    const a = await inQueue(await guest(), 'An');
    const b = await inQueue(await guest(), 'Bình');
    a.send('party:create');
    await sleep(150);
    const code = a.status().party!.code;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    b.send('party:join', code.toLowerCase());
    await sleep(150);
    expect(a.status().party!.members.map((m) => m.nickname)).toEqual(['An', 'Bình']);
    expect(b.status().party).toMatchObject({ isLeader: false });

    b.send('find');
    await sleep(200);
    expect(b.status().state).toBe('idle');
    expect(b.notices.at(-1)).toContain('trưởng nhóm');

    a.send('find', 'kael');
    await Promise.all([a.until('searching'), b.until('searching')]);
    await Promise.all([a.until('accept'), b.until('accept')]);
    a.send('accept');
    b.send('accept');
    const [draftA, draftB] = await Promise.all([a.until('draft'), b.until('draft')]);
    expect(draftA.draft!.team).toBe(draftB.draft!.team);
    expect(draftA.draft!.picks.map((p) => p.nickname).sort()).toEqual(['An', 'Bình']);
    // A teammate's hero cannot be picked.
    const taken = draftA.draft!.picks.find((p) => p.isYou)!.heroId;
    b.send('hero', taken);
    await sleep(150);
    expect(b.status().draft!.picks.find((p) => p.isYou)!.heroId).not.toBe(taken);
    await a.room.leave();
    await b.room.leave();
  }, 20_000);

  it('refuses a third party of more than three, and an unknown party code', async () => {
    const players = await Promise.all(['A', 'B', 'C', 'D'].map(async (n) => inQueue(await guest(), n)));
    players[0].send('party:create');
    await sleep(150);
    const code = players[0].status().party!.code;
    for (const p of players.slice(1)) {
      p.send('party:join', code);
      await sleep(120);
    }
    expect(players[0].status().party!.members).toHaveLength(3);
    expect(players[3].status().party).toBeNull();
    expect(players[3].notices.at(-1)).toContain('đủ 3 người');
    players[3].send('party:join', 'ZZZZZ');
    await sleep(150);
    expect(players[3].notices.at(-1)).toContain('Không tìm thấy nhóm');
    for (const p of players) await p.room.leave();
  }, 15_000);

  it('keeps a banned player out of the queue', async () => {
    const g = await guest();
    await getStore().addPenalty(g.playerId, 'left_match', new Date(Date.now() + 5 * 60_000));
    const me = await inQueue(g, 'Lan');
    expect(me.status().penaltySeconds).toBeGreaterThan(290);
    me.send('find');
    await sleep(300);
    expect(me.status().state).toBe('idle');
    expect(me.notices.at(-1)).toContain('khóa tìm trận 5 phút');
    const profile = (await (await fetch(`${URL}/v1/me`, authed(g.token))).json()) as Profile;
    expect(profile.penaltyUntil).not.toBeNull();
    await me.room.leave();
  });
});
