import { describe, expect, it } from 'vitest';
import { type Command, heroSnapshot, type MatchWelcome, Sim, teamSnapshot, TICK_RATE } from '@game/core';
import { OnlineGame } from './onlineGame';

const TICK_MS = 1000 / TICK_RATE;

/** A server-side sim feeding an OnlineGame through a perfect, instant "network" on a fake clock. */
function setup() {
  const sim = new Sim({
    seed: 3,
    players: [
      { playerId: 'me', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'foe', team: 1, heroId: 'kael', isBot: true },
    ],
  });
  const me = sim.heroOf('me')!;
  const welcome: MatchWelcome = {
    heroId: me.id,
    code: 'ABCDE',
    roster: [
      { heroId: me.id, heroDefId: 'kael', nickname: 'Lan', isBot: false, team: 0 },
      { heroId: sim.heroOf('foe')!.id, heroDefId: 'kael', nickname: 'Bot', isBot: true, team: 1 },
    ],
  };
  let now = 1000;
  const sent: Command[] = [];
  const game = new OnlineGame(
    { send: (_type, cmd) => sent.push(cmd) },
    welcome,
    () => {},
    () => now,
  );
  /** One server tick: step, send the snapshot, let the tick's time pass. */
  const serverTick = () => {
    sim.step();
    game.receive(heroSnapshot(sim, me, teamSnapshot(sim, 0)));
    now += TICK_MS;
  };
  return { sim, me, game, sent, serverTick, wait: (ms: number) => (now += ms) };
}

describe('OnlineGame', () => {
  it('is ready after the first snapshot, with my hero and the static buildings', () => {
    const { game, me, serverTick } = setup();
    expect(game.ready).toBe(false);
    serverTick();
    expect(game.ready).toBe(true);
    expect(game.hero.id).toBe(me.id);
    expect(game.heroes()).toHaveLength(2);
    expect(game.buildings()).toHaveLength(6); // 4 towers + 2 shrines
    expect(game.buildings().filter((b) => b.attacker).length).toBe(4);
  });

  it('shows the game about 100 ms behind the server and blends between snapshots', () => {
    const { sim, me, game, serverTick } = setup();
    serverTick();
    sim.command('me', { t: 'move', x: me.pos.x, z: me.pos.z + 20 });
    const serverZ: number[] = [];
    for (let i = 0; i < 20; i++) {
      serverTick();
      serverZ.push(me.pos.z);
      game.update();
    }
    const shown = game.hero.pos.z;
    // Behind the newest server position, at or ahead of where the server was three ticks ago.
    expect(shown).toBeLessThan(serverZ[19]);
    expect(shown).toBeGreaterThanOrEqual(serverZ[16] - 0.01);
    expect(game.isMoving(game.hero)).toBe(true);
  });

  it('moves smoothly between two snapshots instead of jumping', () => {
    const { sim, me, game, serverTick, wait } = setup();
    serverTick();
    sim.command('me', { t: 'move', x: me.pos.x, z: me.pos.z + 20 });
    for (let i = 0; i < 10; i++) serverTick();
    game.update();
    const a = game.hero.pos.z;
    wait(TICK_MS / 2);
    game.update();
    const b = game.hero.pos.z;
    wait(TICK_MS / 2);
    game.update();
    const c = game.hero.pos.z;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(b - a).toBeCloseTo(c - b, 1);
  });

  it('skips ahead after a stall rather than replaying the backlog', () => {
    const { sim, game, serverTick } = setup();
    serverTick();
    for (let i = 0; i < 60; i++) serverTick(); // three seconds arrive with no frame drawn
    game.update();
    expect(sim.tick - Math.round(game.clock * TICK_RATE)).toBeLessThanOrEqual(10);
  });

  it('builds the hud from my private snapshot and the roster', () => {
    const { sim, game, serverTick } = setup();
    sim.command('me', { t: 'levelUp', slot: 'Q' });
    for (let i = 0; i < 5; i++) serverTick();
    game.update();
    const hud = game.hud();
    expect(hud.abilities[0]).toMatchObject({ slot: 'Q', level: 1, usable: true });
    expect(hud.scores.map((s) => `${s.name} ${s.heroName}`)).toEqual(['Lan Kael', 'Máy Kael']);
    expect(hud.scores[0].isPlayer).toBe(true);
    expect(hud.winner).toBeNull();
  });

  it('sends commands to the server and drops entities that disappear', () => {
    const { sim, game, sent, serverTick } = setup();
    for (let i = 0; i < TICK_RATE * 6; i++) serverTick(); // first minion wave is out
    game.update();
    const minion = [...game.minions()][0];
    expect(minion).toBeDefined();
    sim.dealDamage(sim.get(minion.id)!, 1e6, null);
    for (let i = 0; i < 5; i++) {
      serverTick();
      game.update();
    }
    expect(game.exists(minion.id)).toBe(false);
    game.send({ t: 'stop' });
    expect(sent).toEqual([{ t: 'stop' }]);
  });

  it('hides an enemy that walks into a bush and keeps its score line', () => {
    const { sim, game, serverTick } = setup();
    const foe = sim.heroOf('foe')!;
    sim.setBot('foe', false);
    serverTick();
    game.update();
    expect(game.find(foe.id)).toBeDefined();
    const bush = sim.map.bushes[0];
    foe.pos.x = bush.x;
    foe.pos.z = bush.z;
    for (let i = 0; i < 5; i++) {
      serverTick();
      game.update();
    }
    expect(game.find(foe.id)).toBeUndefined();
    expect(game.heroes()).toHaveLength(1);
    expect(game.roster()).toHaveLength(2);
    expect(game.hud().scores).toHaveLength(2);
  });
});
