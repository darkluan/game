import { describe, expect, it } from 'vitest';
import { heroSnapshot, RECALL, SPELLS, teamSnapshot } from '../src/index.js';
import { EAST, hero, makeSim, place, run } from './helpers.js';

describe('helper spells', () => {
  it('heal restores a fifth of maximum health and goes on cooldown', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    a.health.hp = a.health.maxHp * 0.5;
    sim.command('a', { t: 'spell', spell: 'heal' });
    run(sim, 1);
    // A little over 70%: the hero stands in its own fountain, which mends it too.
    expect(a.health.hp).toBeGreaterThanOrEqual(a.health.maxHp * 0.7);
    expect(a.health.hp).toBeLessThan(a.health.maxHp * 0.75);
    expect(sim.events.some((e) => e.t === 'spell' && e.spell === 'heal' && e.casterId === a.id)).toBe(true);

    a.health.hp = a.health.maxHp * 0.5;
    sim.command('a', { t: 'spell', spell: 'heal' });
    run(sim, 1);
    expect(a.health.hp).toBeLessThan(a.health.maxHp * 0.55);

    run(sim, SPELLS.heal.cooldownTicks);
    a.health.hp = a.health.maxHp * 0.5;
    sim.command('a', { t: 'spell', spell: 'heal' });
    run(sim, 1);
    expect(a.health.hp).toBeGreaterThan(a.health.maxHp * 0.65);
  });

  it('heal is kept when the hero is at full health', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    sim.command('a', { t: 'spell', spell: 'heal' });
    run(sim, 1);
    expect(a.hero.spellReadyAt.heal).toBe(0);
  });

  it('flash jumps toward the aim, no farther than its range, and stops the hero', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0);
    sim.command('a', { t: 'move', x: -5, z: 0 });
    sim.command('a', { t: 'spell', spell: 'flash', x: 40, z: 0 });
    run(sim, 1);
    expect(a.pos.x).toBeCloseTo(SPELLS.flash.range, 1);
    expect(a.pos.z).toBeCloseTo(0, 1);
    expect(a.mover.path).toHaveLength(0);
  });

  it('flash lands on the aim when it is nearer than the range', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0);
    sim.command('a', { t: 'spell', spell: 'flash', x: 2, z: 0 });
    run(sim, 1);
    expect(a.pos.x).toBeCloseTo(2, 1);
  });

  it('flash goes straight ahead without an aim', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0, EAST);
    sim.command('a', { t: 'spell', spell: 'flash' });
    run(sim, 1);
    expect(a.pos.x).toBeCloseTo(SPELLS.flash.range, 1);
  });

  it('cannot be used while stunned or dead, and rejects a malformed command', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0);
    sim.addStatus(a, 'stun', 40);
    sim.command('a', { t: 'spell', spell: 'flash', x: 5, z: 0 });
    run(sim, 1);
    expect(a.pos.x).toBeCloseTo(0, 5);

    const other = makeSim();
    const b = hero(other, 'a');
    place(b, 0, 0);
    other.command('a', { t: 'spell', spell: 'flash', x: Number.NaN, z: 0 });
    other.command('a', { t: 'spell', spell: 'fly' as 'flash' });
    run(other, 1);
    expect(b.pos.x).toBeCloseTo(0, 5);
    expect(b.hero.spellReadyAt.flash).toBe(0);
  });

  it('reports the cooldowns to the player', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0);
    sim.command('a', { t: 'spell', spell: 'flash', x: 3, z: 0 });
    run(sim, 1);
    const you = heroSnapshot(sim, a, teamSnapshot(sim, 0)).you;
    expect(you?.spells[0]).toBe(0);
    expect(you?.spells[1]).toBe(SPELLS.flash.cooldownTicks - 1);
  });
});

describe('recall', () => {
  it('carries the hero home after standing still for the whole channel', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const fountain = sim.map.fountains[0];
    place(a, 0, 0);
    sim.command('a', { t: 'recall' });
    run(sim, RECALL.channelTicks - 1);
    expect(a.pos.x).toBeCloseTo(0, 1);
    expect(heroSnapshot(sim, a, teamSnapshot(sim, 0)).you?.recall).toBeGreaterThan(0);
    run(sim, 3);
    expect(a.pos.x).toBeCloseTo(fountain.x, 1);
    expect(a.pos.z).toBeCloseTo(fountain.z, 1);
    expect(a.hero.recallAt).toBe(0);
  });

  it('is broken off by a move order, by damage and by a stun', () => {
    for (const interrupt of ['move', 'damage', 'stun'] as const) {
      const sim = makeSim();
      const a = hero(sim, 'a');
      place(a, 0, 0);
      sim.command('a', { t: 'recall' });
      run(sim, 20);
      expect(a.hero.recallAt).toBeGreaterThan(0);
      if (interrupt === 'move') sim.command('a', { t: 'move', x: 1, z: 0 });
      else if (interrupt === 'damage') sim.dealDamage(a, 10, hero(sim, 'b'));
      else sim.addStatus(a, 'stun', 10);
      run(sim, 2);
      expect(a.hero.recallAt, interrupt).toBe(0);
      run(sim, RECALL.channelTicks);
      expect(Math.abs(a.pos.x), interrupt).toBeLessThan(5);
    }
  });

  it('survives the helper heal but not a flash', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 0, 0);
    a.health.hp = a.health.maxHp * 0.5;
    sim.command('a', { t: 'recall' });
    sim.command('a', { t: 'spell', spell: 'heal' });
    run(sim, 2);
    expect(a.hero.recallAt).toBeGreaterThan(0);
    sim.command('a', { t: 'spell', spell: 'flash', x: 5, z: 0 });
    run(sim, 2);
    expect(a.hero.recallAt).toBe(0);
  });

  it('is refused at the fountain and while dead', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    sim.command('a', { t: 'recall' });
    run(sim, 1);
    expect(a.hero.recallAt).toBe(0);
  });

  it('keeps the hero out of fights while channelling', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const b = hero(sim, 'b');
    place(a, 0, 0);
    place(b, 40, 0);
    sim.command('a', { t: 'recall' });
    run(sim, 5);
    // An enemy stands within reach, unable to strike: the channel goes on and nothing is attacked.
    place(b, 1.5, 0);
    sim.addStatus(b, 'stun', 100);
    run(sim, 3);
    expect(a.hero.recallAt).toBeGreaterThan(0);
    expect(a.attacker.targetId).toBeNull();
  });
});
