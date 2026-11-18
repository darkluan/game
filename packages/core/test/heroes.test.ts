import { describe, expect, it } from 'vitest';
import { ABILITY_SLOTS, HERO_IDS, HEROES, MINION, seconds, type AbilitySlot } from '../src/index.js';
import { arena, hero, place, run, WEST } from './helpers.js';

describe('every hero', () => {
  const cases = HERO_IDS.flatMap((id) => ABILITY_SLOTS.map((slot) => [id, slot] as [string, AbilitySlot]));

  it.each(cases)('%s can cast %s', (id, slot) => {
    const { sim, a, cast } = arena(id, 'kael');
    const events = cast(slot);
    expect(events.some((e) => e.t === 'cast' && e.casterId === a.id)).toBe(true);
    expect(sim.cooldownLeft(a, slot)).toBeGreaterThan(0);
  });

  it.each(HERO_IDS)('%s has a complete definition', (id) => {
    const def = HEROES[id];
    expect(def.id).toBe(id);
    for (const slot of ABILITY_SLOTS) {
      const ability = def.abilities[slot];
      expect(ability.cooldownTicks).toHaveLength(3);
      expect(ability.cost).toHaveLength(3);
      for (const values of Object.values(ability.params)) expect(values).toHaveLength(3);
      expect(ability.description.length).toBeGreaterThan(10);
    }
    expect(def.resource).toBe(def.race === 'dragon' ? 'none' : def.race === 'machine' ? 'heat' : 'mana');
  });
});

describe('Lyra', () => {
  it('final shot pierces a long line and hits marked targets 50% harder', () => {
    const shot = (marked: boolean) => {
      const { a, b, cast } = arena('lyra', 'kael', 18);
      if (marked) {
        place(b, 6, 0, WEST);
        cast('W');
        place(b, 18, 0, WEST);
      }
      a.hero.mana = a.hero.maxMana;
      const before = b.health.hp;
      cast('R');
      return before - b.health.hp;
    };
    const plain = shot(false);
    expect(plain).toBeGreaterThan(50);
    // Mark adds 15% taken on top of the shot's own 50%.
    expect(shot(true) / plain).toBeCloseTo(1.5 * 1.15, 1);
  });

  it('earns extra gold for a kill', () => {
    const gold = (id: string) => {
      const { sim, a, b } = arena(id, 'kael');
      const before = a.hero.gold;
      sim.dealDamage(b, 1e6, a);
      return a.hero.gold - before;
    };
    expect(gold('lyra') - gold('kael')).toBe(HEROES.lyra.passive!.params.gold);
  });
});

describe('Ignar', () => {
  it('breath leaves fire on the ground that keeps burning', () => {
    const { sim, b, cast } = arena('ignar', 'kael', 4);
    cast('Q');
    expect(sim.q.zones.entities.filter((z) => z.zone.effect === 'burn')).toHaveLength(3);
    const afterHit = b.health.hp;
    run(sim, seconds(1.5));
    expect(b.health.hp).toBeLessThan(afterHit - 20);
    run(sim, seconds(3));
    expect(sim.q.zones.entities).toHaveLength(0);
  });

  it('gust throws enemies back and slows them', () => {
    const { sim, b, cast } = arena('ignar', 'kael', 2);
    cast('E');
    expect(b.pos.x).toBeGreaterThan(5);
    expect(sim.hasStatus(b, 'slow')).toBe(true);
  });
});

describe('Baru', () => {
  it('petrify cuts damage by 75%, roots him and blocks the way', () => {
    const { sim, a, b, cast } = arena('baru', 'kael', 6);
    const hit = () => {
      const before = a.health.hp;
      sim.dealDamage(a, 400, b);
      return before - a.health.hp;
    };
    const normal = hit();
    cast('W');
    expect(hit() / normal).toBeCloseTo(0.25, 1);
    sim.command('a', { t: 'move', x: -10, z: 0 });
    run(sim, 5);
    expect(a.pos.x).toBe(0);
    // An enemy walking straight at him is held off.
    place(b, 3, 0, WEST);
    sim.command('b', { t: 'move', x: -6, z: 0 });
    run(sim, 20);
    expect(b.pos.x).toBeGreaterThan(1.5);
  });

  it('ram shoves the enemies it hits', () => {
    const { b, cast } = arena('baru', 'kael', 3);
    cast('Q');
    expect(b.pos.x).toBeGreaterThan(5);
    expect(b.health.hp).toBeLessThan(b.health.maxHp);
  });
});

describe('Sola', () => {
  const team = () => {
    const game = arena('sola', 'kael', 30);
    run(game.sim, MINION.firstWaveTick + 1);
    const minions = game.sim.q.minions.entities.filter((m) => m.team === 0);
    minions.forEach((m, i) => place(m, game.a.pos.x + 1.5, -2 + i));
    return { ...game, minions };
  };

  it('heals herself and the minions around her', () => {
    const { a, minions, cast } = team();
    a.health.hp = 300;
    minions[0].health.hp = 50;
    cast('Q');
    expect(a.health.hp).toBeCloseTo(300 + HEROES.sola.abilities.Q.params.heal[0], -1);
    expect(minions[0].health.hp).toBeGreaterThan(80);
  });

  it('shields allied minions as well as heroes', () => {
    const { sim, a, minions, cast } = team();
    cast('W');
    expect(sim.hasStatus(a, 'shield')).toBe(true);
    expect(minions.every((m) => sim.hasStatus(m, 'shield'))).toBe(true);
  });
});

describe('Vesper', () => {
  it('ambush lands behind the target and hits harder out of stealth', () => {
    const stab = (stealth: boolean) => {
      const { sim, a, b, cast } = arena('vesper', 'ignar', 5);
      if (stealth) cast('W');
      a.hero.mana = a.hero.maxMana;
      const before = b.health.hp;
      cast('Q');
      expect(a.pos.x).toBeGreaterThan(b.pos.x); // b faces west, so "behind" is east of it
      expect(sim.hasStatus(a, 'stealth')).toBe(false);
      return before - b.health.hp;
    };
    expect(stab(true) / stab(false)).toBeCloseTo(1.5, 1);
  });
});

describe('Bolt-7', () => {
  it('cannon mode reaches farther and hits harder but cannot move', () => {
    const { sim, a, cast } = arena('bolt7', 'kael', 30);
    const before = { range: a.attacker.range, damage: a.attacker.damage };
    cast('W');
    sim.step();
    expect(a.hero.siege).toBe(true);
    expect(a.attacker.range).toBe(before.range + HEROES.bolt7.abilities.W.params.range[0]);
    expect(a.attacker.damage).toBeCloseTo(before.damage * 1.2);
    sim.command('a', { t: 'move', x: 10, z: 0 });
    run(sim, 10);
    expect(a.pos.x).toBe(0);
    a.hero.readyAt.W = 0;
    cast('W');
    sim.command('a', { t: 'move', x: 10, z: 0 });
    run(sim, 10);
    expect(a.pos.x).toBeGreaterThan(1);
  });

  it('vent turns Heat into damage and resets it', () => {
    const blast = (heat: number) => {
      const { a, b, cast } = arena('bolt7', 'ignar', 2);
      a.hero.heat = heat;
      const before = b.health.hp;
      cast('E');
      expect(a.hero.heat).toBe(0);
      return before - b.health.hp;
    };
    expect(blast(40)).toBeGreaterThan(blast(0) * 1.5);
  });
});

describe('Mekka', () => {
  it('builds turrets that shoot enemies, two at most, and they expire', () => {
    const { sim, a, b, cast } = arena('mekka', 'kael', 5);
    cast('Q', { x: 2, z: 2 });
    a.hero.readyAt.Q = 0;
    cast('Q', { x: 2, z: -2 });
    a.hero.readyAt.Q = 0;
    a.hero.heat = 0;
    cast('Q', { x: 1, z: 3 });
    const turrets = sim.q.turrets.entities.filter((t) => !t.dead);
    expect(turrets).toHaveLength(2);
    const before = b.health.hp;
    run(sim, seconds(3));
    expect(b.health.hp).toBeLessThan(before - 20);
    run(sim, HEROES.mekka.abilities.Q.params.lifeTicks[0]);
    expect(sim.q.turrets.entities).toHaveLength(0);
  });

  it('repairs a damaged allied tower, and empowers it with the ultimate', () => {
    const { sim, a, cast } = arena('mekka', 'kael', 40);
    const tower = sim.q.towers.entities.find((t) => t.team === 0 && t.tower.tier === 1)!;
    place(a, tower.pos.x - 3, 3);
    tower.health.hp = 1000;
    cast('W');
    expect(tower.health.hp).toBe(1000 + HEROES.mekka.abilities.W.params.repair[0]);
    cast('R');
    expect(sim.hasStatus(tower, 'attack')).toBe(true);
    expect(tower.health.hp).toBeGreaterThan(1300);
  });

  it('EMP silences: the victim cannot cast', () => {
    const { sim, b, cast } = arena('mekka', 'kael', 5);
    cast('E');
    expect(sim.hasStatus(b, 'silence')).toBe(true);
    cast('W', b.pos, 'b');
    expect(sim.hasStatus(hero(sim, 'b'), 'shield')).toBe(false);
  });
});

describe('buildings', () => {
  it('are not damaged by abilities, only by basic attacks', () => {
    const { sim, a, cast } = arena('ignar', 'kael', 40);
    const tower = sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === 1)!;
    place(a, tower.pos.x - 4, 0);
    const hp = tower.health.hp;
    cast('W', tower.pos);
    cast('Q', tower.pos);
    a.hero.readyAt.R = 0;
    cast('R', tower.pos);
    run(sim, seconds(3));
    expect(tower.health.hp).toBe(hp);
    cast('Q', tower.pos, 'a');
    sim.command('a', { t: 'cast', slot: 'E', targetId: tower.id });
    sim.step();
    a.attacker.cooldown = 0;
    sim.command('a', { t: 'attack', targetId: tower.id });
    run(sim, seconds(2));
    expect(tower.health.hp).toBeLessThan(hp);
  });
});

describe('Mira', () => {
  it('abilities hit 30% harder on a target below 35% health', () => {
    const bolt = (hpFraction: number) => {
      const { b, cast } = arena('mira', 'ignar', 5);
      b.health.hp = b.health.maxHp * hpFraction;
      const before = b.health.hp;
      cast('Q');
      return before - b.health.hp;
    };
    expect(bolt(0.3) / bolt(0.9)).toBeCloseTo(HEROES.mira.passive!.params.mult, 1);
  });

  it('roots enemies in an area and blinks away', () => {
    const { sim, a, b, cast } = arena('mira', 'kael', 5);
    cast('W');
    expect(sim.hasStatus(b, 'root')).toBe(true);
    cast('E', { x: -10, z: 0 });
    expect(a.pos.x).toBeCloseTo(-HEROES.mira.abilities.E.range, 0);
  });
});

describe('Zerak', () => {
  it('dives onto a far target, stuns it, and buffs his own attacks', () => {
    const { sim, a, b, cast } = arena('zerak', 'kael', 6.5);
    cast('R');
    expect(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z)).toBeLessThan(2);
    expect(sim.hasStatus(b, 'stun')).toBe(true);
    const before = sim.statusSum(a, 'attack');
    cast('W');
    expect(sim.statusSum(a, 'attack')).toBeGreaterThan(before);
    expect(sim.hasStatus(a, 'haste')).toBe(true);
  });

  it('evolves like the other dragons', () => {
    const { a } = arena('zerak', 'kael');
    expect(a.hero.stage).toBe(2);
    expect(a.hero.maxMana).toBe(0);
  });
});

describe('Orun', () => {
  it('drags enemies on a line toward himself', () => {
    const { b, cast } = arena('orun', 'kael', 6);
    cast('E');
    expect(b.pos.x).toBeLessThan(3.5);
    expect(b.pos.x).toBeGreaterThan(0.5);
  });

  it('armours himself and nearby allied minions', () => {
    const { sim, a, cast } = arena('orun', 'kael', 30);
    run(sim, MINION.firstWaveTick + 1);
    const minion = sim.q.minions.entities.find((m) => m.team === 0)!;
    place(minion, a.pos.x + 2, 0);
    cast('W');
    expect(sim.statusSum(a, 'armor')).toBe(HEROES.orun.abilities.W.params.armor[0]);
    expect(sim.hasStatus(minion, 'armor')).toBe(true);
    const armoured = sim.dealDamage(a, 200, null);
    sim.removeStatus(a, 'armor');
    expect(sim.dealDamage(a, 200, null)).toBeGreaterThan(armoured);
  });
});

describe('Raze-3', () => {
  it('executes: appears behind the target and hits 50% harder when it is low', () => {
    const strike = (hpFraction: number) => {
      const { a, b, cast } = arena('raze3', 'ignar', 4);
      b.health.hp = b.health.maxHp * hpFraction;
      const before = b.health.hp;
      cast('R');
      expect(a.pos.x).toBeGreaterThan(b.pos.x); // b faces west
      return before - b.health.hp;
    };
    expect(strike(0.3) / strike(0.9)).toBeCloseTo(HEROES.raze3.abilities.R.params.lowMult[0], 1);
  });

  it('runs on Heat and marks with its thrown blade', () => {
    const { sim, a, b, cast } = arena('raze3', 'kael', 5);
    cast('E');
    expect(sim.hasStatus(b, 'mark')).toBe(true);
    expect(a.hero.heat).toBe(HEROES.raze3.abilities.E.cost[0]);
  });
});
