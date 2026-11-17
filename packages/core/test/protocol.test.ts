import { describe, expect, it } from 'vitest';
import { cleanNickname, FLAG_DEAD, FLAG_SHIELD, FLAG_TARGETABLE, snapshotOf, youSnapshotOf } from '../src/index.js';
import { hero, makeSim, run } from './helpers.js';

describe('snapshot', () => {
  it('lists every entity with its flags', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    sim.addStatus(a, 'shield', 100, 50);
    sim.dealDamage(hero(sim, 'b'), 1e6, null);
    const snap = snapshotOf(sim);
    expect(snap.entities).toHaveLength(sim.world.entities.length);
    const byId = new Map(snap.entities.map((e) => [e.id, e]));
    expect(byId.get(a.id)).toMatchObject({ k: 'hero', hd: 'kael', lv: 1, kda: [0, 0, 0] });
    expect(byId.get(a.id)!.fl & FLAG_SHIELD).toBeTruthy();
    expect(byId.get(hero(sim, 'b').id)!.fl & FLAG_DEAD).toBeTruthy();
    // Inner towers are protected while the outer one stands.
    const inner = snap.entities.filter((e) => e.k === 'tower' && !(e.fl & FLAG_TARGETABLE));
    expect(inner).toHaveLength(2);
    expect(snap.entities.find((e) => e.k === 'tower')?.ar).toBeGreaterThan(0);
  });

  it('carries the events of the tick', () => {
    const sim = makeSim();
    sim.command('a', { t: 'levelUp', slot: 'W' });
    sim.step();
    sim.command('a', { t: 'cast', slot: 'W' });
    sim.step();
    expect(snapshotOf(sim).events.some((e) => e.t === 'cast')).toBe(true);
  });

  it('reports the private state of one hero', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    sim.command('a', { t: 'levelUp', slot: 'W' });
    sim.step();
    sim.command('a', { t: 'cast', slot: 'W' });
    run(sim, 20);
    const you = youSnapshotOf(sim, a);
    expect(you.levels).toEqual([0, 1, 0, 0]);
    expect(you.cooldowns[1]).toBeGreaterThan(0);
    expect(you.shield).toBeGreaterThan(0);
    expect(you.mana).toBeLessThan(you.maxMana);
    expect(you.respawn).toBe(0);
  });
});

describe('setBot', () => {
  it('lets the AI drive a hero and gives it back', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const start = a.pos.x;
    sim.setBot('a', true);
    run(sim, 100);
    expect(a.pos.x).toBeGreaterThan(start); // the bot walked out to the lane
    sim.setBot('a', false);
    sim.command('a', { t: 'stop' });
    run(sim, 5);
    const held = a.pos.x;
    run(sim, 40);
    expect(a.pos.x).toBe(held);
  });
});

describe('cleanNickname', () => {
  it('trims, strips control characters and bounds the length', () => {
    expect(cleanNickname('  Lan\u0007\n ')).toBe('Lan');
    expect(cleanNickname('x'.repeat(40))).toHaveLength(16);
    expect(cleanNickname(42)).toBe('');
    expect(cleanNickname('   ')).toBe('');
  });
});
