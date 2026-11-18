import { describe, expect, it } from 'vitest';
import { FOLLOWERS, HEAT, HERO, HEROES, MINION, seconds } from '../src/index.js';
import { arena, hero, makeSim, place, run } from './helpers.js';

describe('machines (Heat)', () => {
  it('gain Heat from casting instead of paying mana, and cool down after a pause', () => {
    const { sim, a, cast } = arena('bolt7');
    expect(a.hero.maxMana).toBe(0);
    cast('Q');
    expect(a.hero.heat).toBe(HEROES.bolt7.abilities.Q.cost[0]);
    run(sim, HEAT.decayDelayTicks);
    expect(a.hero.heat).toBe(HEROES.bolt7.abilities.Q.cost[0]); // not yet
    run(sim, seconds(1));
    expect(a.hero.heat).toBeLessThan(HEROES.bolt7.abilities.Q.cost[0]);
    run(sim, seconds(5));
    expect(a.hero.heat).toBe(0);
  });

  it('hit 25% harder when casting above 50 Heat', () => {
    const dealt = (heat: number) => {
      const { a, b, cast } = arena('bolt7');
      a.hero.heat = heat;
      const before = b.health.hp;
      cast('Q');
      return before - b.health.hp;
    };
    expect(dealt(60) / dealt(10)).toBeCloseTo(HEAT.bonusMult, 2);
  });

  it('overload at 100 Heat: silenced and slowed for 3 seconds, then back to 0', () => {
    const { sim, a, cast } = arena('bolt7');
    a.hero.heat = 85;
    const events = cast('Q');
    expect(events.some((e) => e.t === 'overload')).toBe(true);
    expect(sim.hasStatus(a, 'silence')).toBe(true);
    expect(sim.hasStatus(a, 'slow')).toBe(true);
    a.hero.readyAt.Q = 0;
    const hpBefore = hero(sim, 'b').health.hp;
    cast('Q');
    expect(hero(sim, 'b').health.hp).toBeCloseTo(hpBefore, 0); // silenced: nothing happened
    run(sim, HEAT.overloadTicks);
    expect(a.hero.heat).toBe(0);
    expect(sim.hasStatus(a, 'silence')).toBe(false);
  });

  it('do not regenerate health on their own, only from items or the fountain', () => {
    const { sim, a } = arena('bolt7', 'kael', 30);
    a.health.hp = 100;
    run(sim, seconds(5));
    expect(a.health.hp).toBe(100);
    a.hero.items.push('regen_core');
    run(sim, seconds(2));
    expect(a.health.hp).toBeGreaterThan(110);
    const fountain = sim.map.fountains[0];
    place(a, fountain.x, fountain.z);
    const before = a.health.hp;
    run(sim, seconds(1));
    expect(a.health.hp - before).toBeGreaterThan(50);
  });
});

describe('dragons (evolution)', () => {
  it('cast for free', () => {
    const { a, b, cast } = arena('ignar');
    expect(a.hero.maxMana).toBe(0);
    const before = b.health.hp;
    cast('W');
    expect(b.health.hp).toBeLessThan(before);
  });

  it('evolve at levels 5 and 9: bigger, tougher, stronger abilities', () => {
    const sim = makeSim([
      { playerId: 'a', team: 0, heroId: 'baru', isBot: false },
      { playerId: 'b', team: 1, heroId: 'kael', isBot: false },
    ]);
    const a = hero(sim, 'a');
    const at = (level: number) => {
      a.hero.level = level;
      sim.step();
      return {
        stage: a.hero.stage,
        radius: a.radius,
        maxHp: a.health.maxHp,
        events: sim.events.filter((e) => e.t === 'evolve'),
      };
    };
    const l4 = at(4);
    const l5 = at(5);
    const l9 = at(9);
    expect([l4.stage, l5.stage, l9.stage]).toEqual([0, 1, 2]);
    expect(l5.events).toHaveLength(1);
    expect(l5.radius).toBeGreaterThan(l4.radius);
    expect(l9.radius).toBeGreaterThan(l5.radius);
    const perLevel = HEROES.baru.base.hpPerLevel;
    // Both totals are rounded, so the step between them can be one off.
    const expected = (perLevel + HEROES.baru.evolutions![0].hp) * HERO.toughness;
    expect(Math.abs(l5.maxHp - l4.maxHp - expected)).toBeLessThanOrEqual(1);
  });

  it('Ignar flies straight over walls after the second evolution', () => {
    const trip = (level: number) => {
      const { sim, a } = arena('ignar', 'kael', 40);
      a.hero.level = level;
      sim.step();
      place(a, 11, 5);
      sim.command('a', { t: 'move', x: 11, z: 11 }); // the far side of a lane wall
      run(sim, seconds(1.2));
      return a.pos;
    };
    expect(trip(12).z).toBeGreaterThan(10); // went through
    expect(trip(8).z).toBeLessThan(8); // still walking around
  });
});

describe('gods (followers)', () => {
  it('gain attack and armor per allied minion nearby, up to the cap', () => {
    const { sim, a } = arena('sola', 'kael', 40);
    const base = { attack: a.attacker.damage, armor: a.health.armor };
    run(sim, MINION.firstWaveTick + 1);
    run(sim, MINION.waveIntervalTicks); // ten allied minions exist now
    const minions = sim.q.minions.entities.filter((m) => m.team === 0);
    minions.slice(0, 2).forEach((m, i) => place(m, a.pos.x + 1 + i, 3));
    minions.slice(2).forEach((m) => place(m, a.pos.x - 30, 0));
    sim.step();
    expect(a.hero.followers).toBe(2);
    expect(a.attacker.damage).toBeCloseTo(base.attack * (1 + 2 * FOLLOWERS.attackPerFollower));
    expect(a.health.armor).toBe(base.armor + 2 * FOLLOWERS.armorPerFollower);
    minions.forEach((m, i) => place(m, a.pos.x + 1, -4 + i * 0.8));
    sim.step();
    expect(a.hero.followers).toBe(FOLLOWERS.max);
  });

  it('take 50% longer to respawn', () => {
    const wait = (heroId: string) => {
      const { sim, a } = arena(heroId, 'kael', 40);
      sim.dealDamage(a, 1e6, null);
      return a.hero.respawnTick - sim.tick;
    };
    expect(wait('sola') / wait('kael')).toBeCloseTo(1.5, 1);
  });
});
