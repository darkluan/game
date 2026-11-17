import { describe, expect, it } from 'vitest';
import { MAP, MINION, NavGrid, Sim, type PlayerSetup } from '../src/index.js';
import { hero, makeSim, run } from './helpers.js';

const bots = (n: number): PlayerSetup[] =>
  [0, 1].flatMap((team) =>
    Array.from({ length: n }, (_, i) => ({
      playerId: `bot-${team}-${i}`,
      team: team as 0 | 1,
      heroId: 'kael',
      isBot: true,
    })),
  );

describe('pathfinding', () => {
  const nav = new NavGrid(MAP, [], 0.6);

  it('goes straight when nothing is in the way', () => {
    expect(nav.findPath({ x: 0, z: 0 }, { x: 5, z: 0 })).toEqual([{ x: 5, z: 0 }]);
  });

  it('never crosses a wall', () => {
    const from = { x: 11, z: 4 };
    const path = nav.findPath(from, { x: 11, z: 14 });
    expect(path.length).toBeGreaterThan(1);
    let prev = from;
    for (const p of path) {
      expect(nav.lineClear(prev, p)).toBe(true);
      prev = p;
    }
  });

  it('snaps a blocked destination to the nearest free point', () => {
    const path = nav.findPath({ x: 0, z: 0 }, { x: 11, z: 8 }); // inside a wall
    const end = path[path.length - 1];
    expect(nav.isWalkable(end.x, end.z)).toBe(true);
  });
});

describe('minions', () => {
  it('spawns a wave of 3 melee and 2 ranged per team on schedule', () => {
    const sim = makeSim();
    run(sim, MINION.firstWaveTick + 1);
    const count = (team: number, type: string) =>
      sim.q.minions.entities.filter((m) => m.team === team && m.minion.type === type).length;
    expect([count(0, 'melee'), count(0, 'ranged'), count(1, 'melee'), count(1, 'ranged')]).toEqual([3, 2, 3, 2]);
    run(sim, MINION.waveIntervalTicks);
    const fresh = sim.q.minions.entities.filter((m) => Math.abs(m.pos.x) > 40);
    expect(fresh.length).toBe(10); // the second wave, still at the spawns
  });

  it('meets the enemy wave mid-lane and fights', () => {
    const sim = makeSim();
    run(sim, 20 * 25);
    expect(sim.q.minions.entities.some((m) => m.health.hp < m.health.maxHp)).toBe(true);
  });
});

describe('match', () => {
  it('ignores malformed commands', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const bad = [
      { t: 'move', x: NaN, z: 0 },
      { t: 'move', x: '1', z: 0 },
      { t: 'cast', slot: 'X' },
      { t: 'nope' },
      null,
    ];
    for (const cmd of bad) sim.command('a', cmd as never);
    sim.command('ghost', { t: 'stop' });
    const before = { ...a.pos };
    run(sim, 5);
    expect(a.pos).toEqual(before);
  });

  it('replays identically from the same seed and differs with another', () => {
    const play = (seed: number) => {
      const sim = new Sim({ seed, players: bots(3) });
      run(sim, 20 * 90);
      return sim.hash();
    };
    expect(play(7)).toBe(play(7));
    expect(play(7)).not.toBe(play(8));
  });

  it('ends with a winner when bots play it out', () => {
    const sim = new Sim({ seed: 42, players: bots(3) });
    const limit = 20 * 60 * 30;
    while (sim.winner === null && sim.tick < limit) sim.step();
    console.info(`bot match: winner team ${sim.winner} after ${(sim.tick / 20 / 60).toFixed(1)} min`);
    expect(sim.winner).not.toBeNull();
    const tick = sim.tick;
    sim.step();
    expect(sim.tick).toBe(tick); // frozen once decided
  });
});
