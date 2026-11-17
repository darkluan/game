import { describe, expect, it } from 'vitest';
import { HEROES, MINION, TOWER } from '../src/index.js';
import { EAST, WEST, hero, makeSim, place, run } from './helpers.js';

const kael = HEROES.kael;

describe('damage', () => {
  it('reduces damage by armor', () => {
    const sim = makeSim();
    const tower = sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === 1)!;
    const dealt = sim.dealDamage(tower, 100, hero(sim, 'a'));
    expect(dealt).toBeCloseTo((100 * 100) / (100 + TOWER.armor));
  });

  it("applies Kael's frontal guard by facing", () => {
    const hit = (facing: number) => {
      const sim = makeSim();
      const a = hero(sim, 'a');
      const b = hero(sim, 'b');
      place(a, 0, 0);
      place(b, 2, 0, facing);
      return sim.dealDamage(b, 100, a);
    };
    const base = (100 * 100) / (100 + kael.base.armor);
    expect(hit(WEST)).toBeCloseTo(base * 0.65); // facing the attacker
    expect(hit(EAST)).toBeCloseTo(base * 2); // back turned
    expect(hit(0)).toBeCloseTo(base); // side on
  });

  it('lets a shield absorb damage before hp', () => {
    const sim = makeSim();
    const b = hero(sim, 'b');
    sim.addStatus(b, 'shield', 100, 1000);
    expect(sim.dealDamage(b, 100, null)).toBe(0);
    expect(b.health.hp).toBe(b.health.maxHp);
  });
});

describe('orders', () => {
  it('walks to a point around obstacles', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    place(a, 11, 4);
    sim.command('a', { t: 'move', x: 11, z: 14 }); // other side of a lane wall
    run(sim, 200);
    expect(a.pos.x).toBeCloseTo(11, 0);
    expect(a.pos.z).toBeCloseTo(14, 0);
  });

  it('chases and kills on an attack order, earning the kill', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const b = hero(sim, 'b');
    place(a, 0, 0);
    place(b, 5, 0, EAST);
    b.health.hp = 20;
    sim.command('a', { t: 'attack', targetId: b.id });
    run(sim, 60);
    expect(b.dead).toBe(true);
    expect(a.hero.kills).toBe(1);
    expect(b.hero.deaths).toBe(1);
    expect(a.hero.gold).toBeGreaterThanOrEqual(200);
  });

  it('respawns a dead hero at its fountain with full hp', () => {
    const sim = makeSim();
    const b = hero(sim, 'b');
    place(b, 0, 0);
    sim.dealDamage(b, 1e6, null);
    expect(b.dead).toBe(true);
    run(sim, 20 * 8);
    expect(b.dead).toBe(false);
    expect(b.health.hp).toBe(b.health.maxHp);
    expect(b.pos.x).toBe(sim.map.fountains[1].x);
  });
});

describe('abilities', () => {
  const ready = (slot: 'Q' | 'W' | 'E' | 'R') => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const b = hero(sim, 'b');
    place(a, 0, 0, EAST);
    place(b, 2.5, 0, WEST);
    a.hero.level = 4;
    a.hero.skillPoints = 1;
    sim.command('a', { t: 'levelUp', slot });
    sim.step();
    return { sim, a, b };
  };

  it('rejects a cast with no points in the ability', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    a.hero.skillPoints = 0;
    sim.command('a', { t: 'cast', slot: 'W' });
    sim.step();
    expect(sim.hasStatus(a, 'shield')).toBe(false);
  });

  it('locks the ultimate until level 4', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    sim.command('a', { t: 'levelUp', slot: 'R' });
    sim.step();
    expect(a.hero.abilityLevels.R).toBe(0);
    expect(a.hero.skillPoints).toBe(1);
  });

  it('Q dashes, damages and slows, then goes on cooldown and costs mana', () => {
    const { sim, a, b } = ready('Q');
    const mana = a.hero.mana;
    sim.command('a', { t: 'cast', slot: 'Q', x: 10, z: 0 });
    sim.step();
    expect(a.pos.x).toBeCloseTo(kael.abilities.Q.range, 0);
    expect(b.health.hp).toBeLessThan(b.health.maxHp);
    expect(sim.hasStatus(b, 'slow')).toBe(true);
    expect(a.hero.mana).toBeLessThan(mana);
    expect(sim.cooldownLeft(a, 'Q')).toBeGreaterThan(0);
    const x = a.pos.x;
    sim.command('a', { t: 'cast', slot: 'Q', x: 100, z: 0 });
    sim.step();
    expect(a.pos.x).toBeCloseTo(x, 0); // still on cooldown
  });

  it('W shields the caster', () => {
    const { sim, a } = ready('W');
    sim.command('a', { t: 'cast', slot: 'W' });
    sim.step();
    expect(sim.hasStatus(a, 'shield')).toBe(true);
  });

  it('E stuns its target, and a stunned hero cannot move', () => {
    const { sim, a, b } = ready('E');
    sim.command('a', { t: 'cast', slot: 'E', targetId: b.id });
    sim.step();
    expect(sim.hasStatus(b, 'stun')).toBe(true);
    const x = b.pos.x;
    sim.command('b', { t: 'move', x: 30, z: 0 });
    run(sim, 5);
    expect(b.pos.x).toBe(x);
    expect(a.hero.order).toEqual({ t: 'attack', targetId: b.id });
  });

  it('E is rejected out of range', () => {
    const { sim, a, b } = ready('E');
    place(b, 10, 0);
    sim.command('a', { t: 'cast', slot: 'E', targetId: b.id });
    sim.step();
    expect(sim.hasStatus(b, 'stun')).toBe(false);
    expect(sim.cooldownLeft(a, 'E')).toBe(0);
  });

  it('R leaps to the point and stuns enemies around it', () => {
    const { sim, a, b } = ready('R');
    place(b, 6, 0);
    sim.command('a', { t: 'cast', slot: 'R', x: 6, z: 1 });
    sim.step();
    expect(a.pos.x).toBeCloseTo(6);
    expect(sim.hasStatus(b, 'stun')).toBe(true);
  });
});

describe('towers', () => {
  it('protects the inner tower and shrine until the outer tower falls', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const [outer, inner] = [1, 2].map((tier) =>
      sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === tier)!,
    );
    const shrine = sim.world.entities.find((e) => e.shrine && e.team === 1)!;
    expect(sim.dealDamage(inner, 100, a)).toBe(0);
    expect(sim.dealDamage(shrine, 100, a)).toBe(0);
    sim.dealDamage(outer, 1e6, a);
    expect(sim.dealDamage(inner, 100, a)).toBeGreaterThan(0);
    expect(sim.dealDamage(shrine, 100, a)).toBe(0);
    sim.dealDamage(inner, 1e6, a);
    sim.dealDamage(shrine, 1e6, a);
    expect(sim.winner).toBe(0);
  });

  it('shoots minions first, then turns on a hero that hits an allied hero', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const b = hero(sim, 'b');
    const tower = sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === 1)!;
    run(sim, MINION.firstWaveTick + 1);
    const minion = sim.q.minions.entities.find((m) => m.team === 0)!;
    place(minion, tower.pos.x - 4, 0);
    // Both heroes inside the tower's range but too far apart to start a fight on their own.
    place(a, tower.pos.x - 6, 5);
    place(b, tower.pos.x + 6, -5);
    run(sim, 30);
    expect(sim.get(tower.attacker.targetId ?? -1)?.kind).toBe('minion');
    sim.dealDamage(b, 1, a);
    run(sim, 2);
    expect(tower.attacker.targetId).toBe(a.id);
  });
});
