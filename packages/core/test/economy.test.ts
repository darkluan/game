import { describe, expect, it } from 'vitest';
import { HERO, MAX_LEVEL, MINION, TOWER, xpToNext } from '../src/index.js';
import { hero, makeSim, place, run } from './helpers.js';

function firstEnemyMinion(sim: ReturnType<typeof makeSim>, type: 'melee' | 'ranged') {
  run(sim, MINION.firstWaveTick + 1);
  return sim.q.minions.entities.find((m) => m.team === 1 && m.minion.type === type)!;
}

describe('gold', () => {
  it('pays the last hit on a minion', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const minion = firstEnemyMinion(sim, 'melee');
    const before = a.hero.gold;
    sim.dealDamage(minion, 1e6, a);
    expect(a.hero.gold - before).toBe(MINION.gold.melee);
  });

  it('pays nothing when a minion gets the last hit', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const minion = firstEnemyMinion(sim, 'melee');
    const ally = sim.q.minions.entities.find((m) => m.team === 0)!;
    const before = a.hero.gold;
    sim.dealDamage(minion, 1e6, ally);
    expect(a.hero.gold).toBe(before);
  });

  it('pays the whole team for a tower', () => {
    const sim = makeSim([
      { playerId: 'a', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'a2', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'b', team: 1, heroId: 'kael', isBot: false },
    ]);
    const tower = sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === 1)!;
    sim.dealDamage(tower, 1e6, hero(sim, 'a'));
    expect(hero(sim, 'a').hero.gold).toBe(TOWER.goldPerEnemyHero);
    expect(hero(sim, 'a2').hero.gold).toBe(TOWER.goldPerEnemyHero);
    expect(hero(sim, 'b').hero.gold).toBe(0);
  });

  it('trickles in over time', () => {
    const sim = makeSim();
    run(sim, 20 * 10);
    expect(hero(sim, 'a').hero.gold).toBe(HERO.passiveGoldPerSecond * 10);
  });

  it('pays an assist to a hero that helped', () => {
    const sim = makeSim([
      { playerId: 'a', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'a2', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'b', team: 1, heroId: 'kael', isBot: false },
    ]);
    const b = hero(sim, 'b');
    sim.dealDamage(b, 1, hero(sim, 'a2'));
    sim.dealDamage(b, 1e6, hero(sim, 'a'));
    expect(hero(sim, 'a').hero.kills).toBe(1);
    expect(hero(sim, 'a2').hero.assists).toBe(1);
    expect(hero(sim, 'a2').hero.gold).toBe(HERO.assistGold);
  });
});

describe('experience', () => {
  it('is shared by nearby enemy heroes only', () => {
    const sim = makeSim([
      { playerId: 'a', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'a2', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'far', team: 0, heroId: 'kael', isBot: false },
      { playerId: 'b', team: 1, heroId: 'kael', isBot: false },
    ]);
    const minion = firstEnemyMinion(sim, 'ranged');
    place(hero(sim, 'a'), minion.pos.x - 3, 0);
    place(hero(sim, 'a2'), minion.pos.x - 4, 2);
    sim.dealDamage(minion, 1e6, null);
    expect(hero(sim, 'a').hero.xp).toBe(MINION.xp.ranged / 2);
    expect(hero(sim, 'a2').hero.xp).toBe(MINION.xp.ranged / 2);
    expect(hero(sim, 'far').hero.xp).toBe(0);
  });

  it('levels up with a skill point and stats, capped at the max level', () => {
    const sim = makeSim();
    const a = hero(sim, 'a');
    const b = hero(sim, 'b');
    place(a, 0, 0);
    place(b, 2, 0);
    const maxHp = a.health.maxHp;
    b.hero.level = 1;
    // One hero kill at level 1 is worth more than the first level.
    expect(HERO.killXpBase + HERO.killXpPerLevel).toBeGreaterThan(xpToNext(1));
    sim.dealDamage(b, 1e6, a);
    expect(a.hero.level).toBe(2);
    expect(a.hero.skillPoints).toBe(2);
    expect(a.health.maxHp).toBeGreaterThan(maxHp);

    for (let i = 0; i < 200; i++) {
      b.dead = false;
      b.health.hp = 1;
      sim.dealDamage(b, 1e6, a);
    }
    expect(a.hero.level).toBe(MAX_LEVEL);
    expect(a.hero.skillPoints).toBe(MAX_LEVEL);
  });
});
