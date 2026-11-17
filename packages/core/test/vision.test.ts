import { describe, expect, it } from 'vitest';
import { bushAt, heroSnapshot, MAP, MINION, teamSnapshot, VISION } from '../src/index.js';
import { arena, place, run } from './helpers.js';

const BUSH = MAP.bushes[0];

describe('bushes', () => {
  it('hide a unit from enemies outside, until one of them steps in', () => {
    const { sim, a, b } = arena('kael', 'kael');
    place(b, BUSH.x, BUSH.z);
    place(a, BUSH.x - 8, BUSH.z - 6);
    expect(bushAt(sim.map, b.pos)).toBe(0);
    expect(sim.isVisibleTo(b, 0)).toBe(false);
    expect(sim.isVisibleTo(a, 1)).toBe(true); // standing in the open
    place(a, BUSH.x + 2.5, BUSH.z);
    sim.step();
    expect(sim.isVisibleTo(b, 0)).toBe(true);
  });

  it('keep a hidden enemy from being attacked or targeted', () => {
    const { sim, a, b, cast } = arena('kael', 'kael');
    place(b, BUSH.x, BUSH.z);
    place(a, BUSH.x - 4.5, BUSH.z - 3);
    sim.command('a', { t: 'attack', targetId: b.id });
    sim.step();
    expect(a.hero.order.t).toBe('idle');
    cast('E'); // unit-targeted
    expect(sim.cooldownLeft(a, 'E')).toBe(0);
    expect(sim.nearestEnemy(a, 30, (e) => e.hero !== undefined)).toBeNull();
  });

  it('are left out of the enemy team snapshot', () => {
    const { sim, a, b } = arena('kael', 'kael');
    place(b, BUSH.x, BUSH.z);
    place(a, BUSH.x - 8, BUSH.z - 6);
    sim.step();
    expect(teamSnapshot(sim, 0).entities.some((e) => e.id === b.id)).toBe(false);
    expect(teamSnapshot(sim, 1).entities.some((e) => e.id === b.id)).toBe(true);
  });

  it('do not hide from minions that walk in', () => {
    const { sim, b } = arena('kael', 'kael', 40);
    place(b, BUSH.x, BUSH.z);
    run(sim, MINION.firstWaveTick + 1);
    const scout = sim.q.minions.entities.find((m) => m.team === 0)!;
    place(scout, BUSH.x + 1, BUSH.z);
    sim.step();
    expect(sim.isVisibleTo(b, 0)).toBe(true);
  });
});

describe('stealth', () => {
  it('hides Vesper until an enemy is right next to her, and breaks when she attacks', () => {
    const { sim, a, b, cast } = arena('vesper', 'kael', 8);
    cast('W');
    expect(sim.hasStatus(a, 'stealth')).toBe(true);
    expect(sim.isVisibleTo(a, 1)).toBe(false);
    place(a, b.pos.x - VISION.revealRange + 0.5, 0);
    sim.step();
    expect(sim.isVisibleTo(a, 1)).toBe(true);
    a.attacker.cooldown = 0;
    sim.command('a', { t: 'attack', targetId: b.id });
    run(sim, 3);
    expect(sim.hasStatus(a, 'stealth')).toBe(false);
  });

  it('does not auto-attack while hidden', () => {
    const { sim, a, cast } = arena('vesper', 'kael', 2.5);
    cast('W');
    a.attacker.cooldown = 0;
    run(sim, 10);
    expect(sim.hasStatus(a, 'stealth')).toBe(true);
  });
});

describe('mark and traps', () => {
  it('a marked hero cannot hide in a bush', () => {
    const { sim, a, b, cast } = arena('lyra', 'kael', 6);
    cast('W');
    place(b, BUSH.x, BUSH.z);
    place(a, BUSH.x - 8, BUSH.z - 6);
    sim.step();
    expect(sim.isVisibleTo(b, 0)).toBe(true);
  });

  it("Lyra's trap is invisible from afar, then roots and marks the hero who steps on it", () => {
    const { sim, a, b, cast } = arena('lyra', 'kael', 12);
    cast('Q', { x: 4, z: 0 });
    const trap = sim.q.traps.entities[0];
    expect(trap.pos.x).toBeCloseTo(4, 0);
    expect(sim.isVisibleTo(trap, 1)).toBe(false);
    expect(teamSnapshot(sim, 1).entities.some((e) => e.k === 'trap')).toBe(false);
    place(b, 4.5, 0);
    const hp = b.health.hp;
    sim.step();
    sim.step();
    expect(sim.hasStatus(b, 'root')).toBe(true);
    expect(sim.hasStatus(b, 'mark')).toBe(true);
    expect(b.health.hp).toBeLessThan(hp);
    expect(sim.q.traps.entities.filter((t) => !t.dead)).toHaveLength(0);
    sim.command('b', { t: 'move', x: 20, z: 0 });
    run(sim, 5);
    expect(b.pos.x).toBeCloseTo(4.5); // rooted
    expect(a.hero.kills).toBe(0);
  });

  it('keeps at most three traps', () => {
    const { sim, a, cast } = arena('lyra', 'kael', 30);
    for (let i = 0; i < 5; i++) {
      a.hero.readyAt.Q = 0;
      a.hero.mana = a.hero.maxMana;
      cast('Q', { x: 2 + i, z: 3 });
    }
    expect(sim.q.traps.entities.filter((t) => !t.dead)).toHaveLength(3);
  });
});

describe('blindness', () => {
  it("Vesper's darkness cuts an enemy hero's sight to a few steps", () => {
    const { sim, a, b, cast } = arena('vesper', 'kael', 7);
    cast('R');
    run(sim, 6);
    expect(sim.hasStatus(b, 'blind')).toBe(true);
    expect(sim.canSee(b, a)).toBe(false);
    const mine = heroSnapshot(sim, b, teamSnapshot(sim, 1));
    expect(mine.entities.some((e) => e.id === a.id)).toBe(false);
    expect(teamSnapshot(sim, 1).entities.some((e) => e.id === a.id)).toBe(true); // teammates still see her
    place(a, b.pos.x - 2, 0);
    sim.step();
    expect(sim.canSee(b, a)).toBe(true);
  });
});
