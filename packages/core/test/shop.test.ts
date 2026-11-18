import { describe, expect, it } from 'vitest';
import { discountOf, HERO_BUILDS, HERO_IDS, HEROES, ITEMS, itemPrice, raceOf, recommendedBuild } from '../src/index.js';
import { arena, place, run } from './helpers.js';

/** A hero standing on its own fountain with plenty of gold. */
function shopper(heroId = 'ignar') {
  const game = arena(heroId, 'kael', 40);
  const fountain = game.sim.map.fountains[0];
  place(game.a, fountain.x, fountain.z);
  game.a.hero.gold = 5000;
  const buy = (itemId: string) => {
    game.sim.command('a', { t: 'buy', itemId });
    game.sim.step();
  };
  return { ...game, buy };
}

describe('shop', () => {
  it('sells an item at the fountain: gold goes down, stats go up', () => {
    const { a, buy } = shopper();
    const attack = a.attacker.damage;
    buy('iron_sword');
    expect(a.hero.items).toEqual(['iron_sword']);
    expect(a.hero.gold).toBe(5000 - ITEMS.iron_sword.cost);
    expect(a.attacker.damage).toBe(attack + ITEMS.iron_sword.stats.attack!);
  });

  it('is closed away from the fountain, open while dead', () => {
    const { sim, a, buy } = shopper();
    place(a, 0, 0);
    buy('iron_sword');
    expect(a.hero.items).toEqual([]);
    sim.dealDamage(a, 1e6, null);
    buy('iron_sword');
    expect(a.hero.items).toEqual(['iron_sword']);
  });

  it('refuses a purchase the hero cannot afford and unknown items', () => {
    const { a, buy } = shopper();
    a.hero.gold = 100;
    buy('iron_sword');
    a.hero.gold = 5000;
    buy('no_such_item');
    buy('__proto__');
    buy(42 as never);
    expect(a.hero.items).toEqual([]);
    expect(a.hero.gold).toBe(5000);
  });

  it('gives humans a fifth slot and a 10% discount', () => {
    const fill = (heroId: string) => {
      const { a, buy } = shopper(heroId);
      for (let i = 0; i < 6; i++) buy('leather_armor');
      return { count: a.hero.items.length, spent: 5000 - a.hero.gold };
    };
    expect(fill('ignar')).toEqual({ count: 4, spent: 4 * ITEMS.leather_armor.cost });
    expect(fill('kael')).toEqual({ count: 5, spent: 5 * ITEMS.leather_armor.cost * 0.9 });
    expect(itemPrice('great_blade', discountOf(HEROES.lyra, { speed: false, race: null }))).toBe(675);
  });

  it('buys an item back for half its price', () => {
    const { sim, a, buy } = shopper();
    buy('steel_armor');
    const gold = a.hero.gold;
    sim.command('a', { t: 'sell', slotIndex: 0 });
    sim.command('a', { t: 'sell', slotIndex: 7 });
    sim.command('a', { t: 'sell', slotIndex: 0.5 });
    sim.step();
    expect(a.hero.items).toEqual([]);
    expect(a.hero.gold).toBe(gold + ITEMS.steel_armor.cost / 2);
  });
});

describe('item effects', () => {
  it('lifesteal heals the attacker for part of the damage dealt', () => {
    const { sim, a, b } = arena('kael', 'kael');
    a.hero.items.push('blood_axe');
    a.health.hp = 200;
    a.attacker.cooldown = 0;
    sim.command('a', { t: 'attack', targetId: b.id });
    run(sim, 3);
    expect(a.health.hp).toBeGreaterThan(200 + 3);
  });

  it('cooldown reduction shortens cooldowns', () => {
    const cooldown = (items: string[]) => {
      const { sim, a, cast } = arena('kael', 'kael');
      a.hero.items.push(...items);
      cast('W');
      return sim.cooldownLeft(a, 'W');
    };
    expect(cooldown(['hourglass']) / cooldown([])).toBeCloseTo(0.85, 1);
    // Capped however many are stacked.
    expect(cooldown(['hourglass', 'hourglass', 'hourglass', 'hourglass']) / cooldown([])).toBeCloseTo(0.6, 1);
  });

  it('attack speed shortens the time between attacks', () => {
    const { sim, a } = arena('lyra', 'kael');
    const before = a.attacker.intervalTicks;
    a.hero.items.push('swift_bow');
    sim.step();
    expect(a.attacker.intervalTicks).toBe(Math.round(before / 1.25));
  });
});

describe('recommended builds', () => {
  it('has one for every hero: real items, none twice, exactly as many as the hero can carry', () => {
    for (const id of HERO_IDS) {
      const build = HERO_BUILDS[id];
      expect(build, id).toBeDefined();
      expect(
        build.every((item) => item in ITEMS),
        id,
      ).toBe(true);
      expect(new Set(build).size, id).toBe(build.length);
      expect(build.length, id).toBe(raceOf(HEROES[id].race).itemSlots);
    }
  });

  it('gives a hero without mana nothing bought for its mana', () => {
    for (const id of HERO_IDS) {
      if (HEROES[id].resource === 'mana') continue;
      expect(HERO_BUILDS[id], id).not.toContain('mana_gem');
    }
  });

  it("falls back to the role's build for a hero that has none of its own", () => {
    expect(recommendedBuild('kael', 'fighter')).toBe(HERO_BUILDS.kael);
    expect(recommendedBuild('someone-new', 'tank')).toContain('giant_heart');
  });
});
