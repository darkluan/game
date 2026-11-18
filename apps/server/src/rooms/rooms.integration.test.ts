import { Client, type Room } from '@colyseus/sdk';
import type { LobbyState, MatchWelcome, Snapshot } from '@game/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer } from '../app.js';

/** Real server, real WebSocket clients: the whole lobby-to-match flow over the wire. */

const PORT = 2591;
const URL = `http://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const server = createGameServer();

async function guest(): Promise<{ playerId: string; token: string }> {
  const response = await fetch(`${URL}/v1/guests`, { method: 'POST' });
  return (await response.json()) as { playerId: string; token: string };
}

/** Join a lobby and keep track of the latest state it broadcasts. */
async function inLobby(join: Promise<Room>): Promise<{ room: Room; state: () => LobbyState }> {
  const room = await join;
  let latest: LobbyState | undefined;
  room.onMessage('lobby', (s: LobbyState) => (latest = s));
  await sleep(200);
  return { room, state: () => latest! };
}

async function inMatch(join: Promise<Room>): Promise<{ room: Room; welcome: () => MatchWelcome; snaps: Snapshot[] }> {
  const room = await join;
  let welcome: MatchWelcome | undefined;
  const snaps: Snapshot[] = [];
  room.onMessage('welcome', (w: MatchWelcome) => (welcome = w));
  room.onMessage('s', (s: Snapshot) => snaps.push(s));
  await sleep(300);
  return { room, welcome: () => welcome!, snaps };
}

const rejected = (join: Promise<unknown>) =>
  join.then(
    () => false,
    () => true,
  );

beforeAll(async () => {
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

describe('lobby', () => {
  it('uses a 5-character code as the room id and lists who joined', async () => {
    const [a, b] = [await guest(), await guest()];
    const host = await inLobby(new Client(URL).create('lobby', { token: a.token, nickname: '  An  ' }));
    const code = host.room.roomId;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    const other = await inLobby(new Client(URL).joinById(code, { token: b.token, nickname: 'Bình' }));
    expect(host.state().players).toMatchObject([
      { nickname: 'An', team: 0, isHost: true },
      { nickname: 'Bình', team: 1, isHost: false },
    ]);

    other.room.send('hero', 'vesper');
    other.room.send('hero', 'nobody');
    await sleep(150);
    expect(host.state().players[1].heroId).toBe('vesper');

    other.room.send('team', 0);
    await sleep(150);
    expect(host.state().players[1].team).toBe(0);

    await host.room.leave();
    await sleep(150);
    expect(other.state().players).toMatchObject([{ nickname: 'Bình', isHost: true }]);
    await other.room.leave();
  });

  it('turns away forged tokens, unknown codes and direct match creation', async () => {
    const a = await guest();
    const host = await inLobby(new Client(URL).create('lobby', { token: a.token, nickname: 'An' }));
    const stranger = new Client(URL);
    expect(await rejected(stranger.joinById(host.room.roomId, { token: 'forged.token' }))).toBe(true);
    expect(await rejected(stranger.joinById('ZZZZZ', { token: a.token }))).toBe(true);
    expect(await rejected(stranger.create('match', { code: 'X', players: [] }))).toBe(true);
    await host.room.leave();
  });
});

describe('a full room', () => {
  it('seats six players three a side, turns the seventh away and starts with no bots', async () => {
    const guests = await Promise.all(Array.from({ length: 7 }, guest));
    const clients = guests.map(() => new Client(URL));
    const host = await inLobby(clients[0].create('lobby', { token: guests[0].token, nickname: 'P0' }));
    const code = host.room.roomId;
    const others = [];
    for (let i = 1; i < 6; i++) {
      others.push(await inLobby(clients[i].joinById(code, { token: guests[i].token, nickname: `P${i}` })));
    }
    expect(host.state().players.map((p) => p.team)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(await rejected(clients[6].joinById(code, { token: guests[6].token, nickname: 'P6' }))).toBe(true);

    for (const other of others) other.room.send('ready', true);
    await sleep(150);
    host.room.send('start');
    await sleep(500);
    const matchRoomId = host.state().matchRoomId!;
    const seats = await Promise.all(
      guests.slice(0, 6).map((g, i) => inMatch(clients[i].joinById(matchRoomId, { token: g.token }))),
    );
    expect(seats[0].welcome().roster.every((r) => !r.isBot)).toBe(true);
    expect(new Set(seats.map((s) => s.welcome().heroId)).size).toBe(6); // everyone got their own hero
    await sleep(500);
    for (const seat of seats) expect(seat.snaps.length).toBeGreaterThan(5);

    for (const seat of seats) await seat.room.leave();
    for (const lobby of [host, ...others]) await lobby.room.leave();
  }, 20_000);
});

describe('match', () => {
  it('runs a match from the lobby: start, snapshots, commands, bot hand-over and rejoin by link', async () => {
    const [a, b, c] = [await guest(), await guest(), await guest()];
    const clientA = new Client(URL);
    const host = await inLobby(clientA.create('lobby', { token: a.token, nickname: 'An' }));
    const code = host.room.roomId;
    const other = await inLobby(new Client(URL).joinById(code, { token: b.token, nickname: 'Bình' }));

    host.room.send('hero', 'ignar');
    other.room.send('start');
    await sleep(200);
    expect(host.state().matchRoomId).toBeNull(); // only the host may start

    host.room.send('start');
    await sleep(200);
    expect(host.state().matchRoomId).toBeNull(); // not while someone has yet to say they are ready
    expect(host.state().players.map((p) => p.ready)).toEqual([true, false]);

    // A phrase sent in the pick room reaches everyone; anything that is not a known phrase does not.
    const heard: unknown[] = [];
    host.room.onMessage('chat', (m: unknown) => heard.push(m));
    other.room.send('chat', 'hello');
    other.room.send('chat', 'buy my gold');
    other.room.send('chat', { text: '  chờ   mình, fuck lag ' });
    other.room.send('ready', true);
    await sleep(200);
    expect(heard).toEqual([
      { playerId: b.playerId, id: 'hello' },
      { playerId: b.playerId, text: 'chờ mình, **** lag' },
    ]);
    expect(host.state().players[1].ready).toBe(true);

    host.room.send('start');
    await sleep(500);
    const matchRoomId = host.state().matchRoomId!;
    expect(matchRoomId).toEqual(expect.any(String));
    expect(await rejected(new Client(URL).joinById(matchRoomId, { token: c.token }))).toBe(true); // not in the roster

    const match = await inMatch(clientA.joinById(matchRoomId, { token: a.token }));
    const { heroId, roster } = match.welcome();
    // My pick is my hero; no team has the same hero twice, bots included.
    expect(roster.find((r) => r.heroId === heroId)!.heroDefId).toBe('ignar');
    for (const team of [0, 1]) {
      const heroes = roster.filter((r) => r.team === team).map((r) => r.heroDefId);
      expect(new Set(heroes).size).toBe(3);
    }
    expect(roster.map((r) => r.nickname).sort()).toEqual(['An', 'Bot', 'Bot', 'Bot', 'Bot', 'Bình']);
    expect(match.welcome().code).toBe(code);
    const last = () => match.snaps[match.snaps.length - 1];
    const entity = (id: number) => last().entities.find((e) => e.id === id)!;

    // Team chat: my phrase comes back to my team (here, me) with my hero on it; the other side hears nothing.
    const enemy = await inMatch(new Client(URL).joinById(matchRoomId, { token: b.token }));
    const mine: unknown[] = [];
    const theirs: unknown[] = [];
    match.room.onMessage('chat', (m: unknown) => mine.push(m));
    enemy.room.onMessage('chat', (m: unknown) => theirs.push(m));
    match.room.send('chat', { k: 'quick', id: 'help' });
    match.room.send('chat', { k: 'quick', id: 'free text' });
    match.room.send('chat', { k: 'text', text: 'lên  đường trên' });
    match.room.send('chat', { k: 'ping', type: 'gather', x: 4, z: -2 });
    await sleep(200);
    expect(mine).toEqual([
      { k: 'quick', id: 'help', heroId },
      { k: 'text', text: 'lên đường trên', heroId },
      { k: 'ping', type: 'gather', x: 4, z: -2, heroId },
    ]);
    expect(theirs).toEqual([]);
    await enemy.room.leave();

    // Nobody played for me while I was connecting: the skill point is still mine to spend.
    expect(last().you).toMatchObject({ id: heroId, skillPoints: 1 });

    const before = match.snaps.length;
    await sleep(1000);
    expect(match.snaps.length - before).toBeGreaterThanOrEqual(17);
    expect(match.snaps.length - before).toBeLessThanOrEqual(23);

    const { x, z } = entity(heroId);
    match.room.send('cmd', { t: 'move', x, z: z + 6 });
    match.room.send('cmd', { t: 'levelUp', slot: 'Q' });
    match.room.send('cmd', { t: 'move', x: 'NaN', z: {} }); // garbage is ignored
    match.room.send('cmd', null);
    await sleep(1300);
    expect(entity(heroId).z).toBeCloseTo(z + 6, 0);
    expect(last().you!.levels[0]).toBe(1);

    // Bình never connected: after the grace period a bot walks that hero down the lane.
    const binh = roster.find((r) => r.nickname === 'Bình')!.heroId;
    const idleX = entity(binh).x;
    await sleep(4500);
    expect(Math.abs(entity(binh).x - idleX)).toBeGreaterThan(2);

    // My connection drops without warning. Seen from Bình's side, a bot takes my hero over after
    // the grace period.
    const watcher = await inMatch(new Client(URL).joinById(matchRoomId, { token: b.token }));
    const seen = (id: number) => watcher.snaps[watcher.snaps.length - 1].entities.find((e) => e.id === id)!;
    match.room.send('cmd', { t: 'stop' });
    const tickWhenLeft = last().tick;
    await match.room.leave(false);
    await host.room.leave();
    await sleep(1000);
    const restingX = seen(heroId).x;
    await sleep(3000);
    expect(seen(heroId).x).toBe(restingX); // still inside the grace period
    await sleep(3000);
    expect(Math.abs(seen(heroId).x - restingX)).toBeGreaterThan(2);

    // I open the link again: the lobby still points at the match and lets me back in.
    const back = await inLobby(clientA.joinById(code, { token: a.token, nickname: 'An' }));
    expect(back.state().matchRoomId).toBe(matchRoomId);
    const again = await inMatch(clientA.joinById(matchRoomId, { token: a.token }));
    expect(again.welcome().heroId).toBe(heroId);
    expect(again.snaps[again.snaps.length - 1].tick).toBeGreaterThan(tickWhenLeft);

    await again.room.leave();
    await watcher.room.leave();
    await back.room.leave();
    await other.room.leave();
  }, 30_000);
});
