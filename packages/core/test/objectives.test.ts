import { describe, expect, it } from 'vitest';
import { BEAST, MINION, RELIC, snapshotOf, TOWER, type RelicType } from '../src/index.js';
import { arena, place, run } from './helpers.js';

/** A match fast-forwarded to the first relic, with both heroes parked in their bases until then. */
function atFirstRelic(heroA = 'kael', heroB = 'kael') {
  const game = arena(heroA, heroB, 40);
  place(game.a, -50, 10);
  place(game.b, 50, 10);
  let spawned: { pedestal: number; relic: RelicType } | undefined;
  while (!spawned) {
    game.sim.step();
    for (const e of game.sim.events) if (e.t === 'relicSpawn') spawned = e;
  }
  const at = game.sim.map.pedestals[spawned.pedestal];
  /** Put the relic of the test's choosing on the lit pedestal. */
  const setRelic = (type: RelicType) => (game.sim.relic!.type = type);
  /** Hero a stands on the pedestal until it captures. */
  const captureBy = (who: 'a' | 'b' = 'a') => {
    const h = who === 'a' ? game.a : game.b;
    place(h, at.x, at.z);
    h.health.hp = h.health.maxHp;
    run(game.sim, RELIC.captureTicks + 1);
  };
  return { ...game, at, spawned, setRelic, captureBy };
}

describe('relic pedestals', () => {
  it('light one pedestal with one relic at the two minute mark', () => {
    const { sim, spawned } = atFirstRelic();
    expect(sim.tick).toBe(RELIC.firstTick + 1);
    expect(sim.relic).toMatchObject({ pedestal: spawned.pedestal, type: spawned.relic, team: null, progress: 0 });
    expect(snapshotOf(sim).world.relic).toMatchObject({ pedestal: spawned.pedestal, progress: 0 });
  });

  it('are captured by standing on them for five seconds', () => {
    const { sim, a, at } = atFirstRelic();
    place(a, at.x, at.z);
    run(sim, RELIC.captureTicks - 2);
    expect(sim.buffs[0]).toBeNull();
    expect(snapshotOf(sim).world.relic!.progress).toBeGreaterThan(0.9);
    run(sim, 3);
    expect(sim.relic).toBeNull();
    expect(sim.buffs[0]).toMatchObject({ relic: expect.any(String) });
    expect(sim.buffs[1]).toBeNull();
    expect(snapshotOf(sim).world.buffs[0]!.left).toBeGreaterThan(RELIC.buffTicks - 5);
  });

  it('start over when the hero steps off, is hit by an enemy hero, or an enemy steps on', () => {
    const { sim, a, b, at } = atFirstRelic();
    const half = () => {
      place(a, at.x, at.z);
      run(sim, RELIC.captureTicks / 2);
      expect(sim.relic!.progress).toBeGreaterThan(0);
    };
    half();
    place(a, at.x + 6, at.z - 4);
    sim.step();
    expect(sim.relic!.progress).toBe(0);

    half();
    sim.dealDamage(a, 5, b);
    sim.step();
    expect(sim.relic!.progress).toBe(0);

    half();
    place(b, at.x + 1, at.z);
    sim.step();
    expect(sim.relic!.progress).toBe(0);
    expect(sim.relic!.team).toBeNull();
  });

  it('wear off after a minute, and a new relic appears two minutes after the last', () => {
    const { sim, captureBy } = atFirstRelic();
    captureBy();
    run(sim, RELIC.buffTicks);
    expect(sim.buffs[0]).toBeNull();
    while (sim.tick <= RELIC.firstTick + RELIC.intervalTicks) sim.step();
    expect(sim.relic).not.toBeNull();
  });
});

describe('relic effects', () => {
  it('Thunder: a hero basic attack arcs to two other enemies nearby', () => {
    const { sim, a, b, setRelic, captureBy } = atFirstRelic();
    setRelic('thunder');
    captureBy();
    const minions = sim.q.minions.entities.filter((m) => m.team === 1).slice(0, 3);
    place(a, 0, -20);
    place(b, 2, -20);
    minions.forEach((m, i) => place(m, 3 + i, -19));
    const before = minions.map((m) => m.health.hp);
    a.attacker.cooldown = 0;
    sim.command('a', { t: 'attack', targetId: b.id });
    run(sim, 2);
    const hit = minions.filter((m, i) => m.health.hp < before[i]);
    expect(hit).toHaveLength(RELIC.thunder.targets);
  });

  it('Shield: allied minions and towers absorb damage, including minions that spawn later', () => {
    const { sim, setRelic, captureBy } = atFirstRelic();
    setRelic('shield');
    captureBy();
    const tower = sim.q.towers.entities.find((t) => t.team === 0 && t.tower.tier === 1)!;
    expect(sim.statusSum(tower, 'shield')).toBe(RELIC.shield.tower);
    const hp = tower.health.hp;
    sim.dealDamage(tower, 300, null);
    expect(tower.health.hp).toBe(hp);
    const enemyTower = sim.q.towers.entities.find((t) => t.team === 1)!;
    expect(sim.hasStatus(enemyTower, 'shield')).toBe(false);
    const known = new Set(sim.q.minions.entities.map((m) => m.id));
    run(sim, MINION.waveIntervalTicks);
    const fresh = sim.q.minions.entities.filter((m) => m.team === 0 && !known.has(m.id));
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((m) => sim.hasStatus(m, 'shield'))).toBe(true);
  });

  it('Fury: the team deals 25% more and takes 15% more', () => {
    const measure = (fury: boolean) => {
      const { sim, a, b, setRelic, captureBy } = atFirstRelic();
      setRelic(fury ? 'fury' : 'shield');
      captureBy();
      place(a, 0, -20);
      place(b, 2, -20);
      a.health.hp = a.health.maxHp;
      b.health.hp = b.health.maxHp;
      const dealt = sim.dealDamage(b, 100, a);
      const taken = sim.dealDamage(a, 100, b);
      return { dealt, taken };
    };
    const plain = measure(false);
    const fury = measure(true);
    expect(fury.dealt / plain.dealt).toBeCloseTo(RELIC.fury.dealt, 2);
    expect(fury.taken / plain.taken).toBeCloseTo(RELIC.fury.taken, 2);
  });
});

describe('the Ancient Beast', () => {
  /** Fast-forward to minute seven with both heroes parked safely. */
  function atBeast() {
    const game = arena('kael', 'kael', 40);
    place(game.a, -50, 10);
    place(game.b, 50, 10);
    // Keep the lane from deciding the match while we wait.
    for (const e of game.sim.q.units) if (e.tower || e.shrine) e.health.armor = 1e6;
    run(game.sim, BEAST.spawnTick + 1);
    const beast = game.sim.q.monsters.entities.find((m) => m.monster.type === 'beast')!;
    return { ...game, beast };
  }

  it('appears in its cave at minute seven', () => {
    const { sim, beast } = atBeast();
    expect(sim.tick).toBeGreaterThan(BEAST.spawnTick);
    expect(beast.pos).toEqual(sim.map.beastCave);
    expect(beast.health.hp).toBe(BEAST.wild.hp);
    expect(sim.q.monsters.entities.filter((m) => m.monster.type === 'beast')).toHaveLength(1);
  });

  it('marches with the next wave of the team that slew it, and pays that team', () => {
    const { sim, a, beast } = atBeast();
    const gold = a.hero.gold;
    sim.dealDamage(beast, 1e6, a);
    expect(sim.beast.owner).toBe(0);
    expect(a.hero.gold - gold).toBe(BEAST.teamGold);
    expect(sim.events.some((e) => e.t === 'beastSlain' && e.team === 0)).toBe(true);
    let marched = false;
    for (let i = 0; i <= MINION.waveIntervalTicks && !marched; i++) {
      sim.step();
      marched = sim.events.some((e) => e.t === 'beastMarch' && e.team === 0);
    }
    expect(marched).toBe(true);
    const marching = sim.q.minions.entities.filter((m) => m.minion.type === 'beast');
    expect(marching).toHaveLength(1);
    expect(marching[0].team).toBe(0);
    expect(sim.beast.owner).toBeNull();
    const x = marching[0].pos.x;
    run(sim, 100);
    expect(marching[0].pos.x).toBeGreaterThan(x + 10); // heading for the enemy shrine
  });

  it('tears down buildings far faster than it hurts units', () => {
    const { sim, a, beast } = atBeast();
    for (const e of sim.q.units) if (e.tower) e.health.armor = TOWER.armor;
    sim.dealDamage(beast, 1e6, a);
    run(sim, MINION.waveIntervalTicks + 1);
    const marching = sim.q.minions.entities.find((m) => m.minion.type === 'beast')!;
    const tower = sim.q.towers.entities.find((t) => t.team === 1 && t.tower.tier === 1)!;
    for (const m of sim.q.minions.entities) if (m.team === 1) m.dead = true;
    place(marching, tower.pos.x - 3, 0);
    const hp = tower.health.hp;
    marching.attacker.cooldown = 0;
    run(sim, 3);
    const perHit = (BEAST.march.attack * BEAST.march.structureMult * 100) / (100 + TOWER.armor);
    expect(hp - tower.health.hp).toBeCloseTo(perHit, 0);
  });

  it('returns to the cave some time after the marching Beast dies', () => {
    const { sim, a, beast } = atBeast();
    sim.dealDamage(beast, 1e6, a);
    run(sim, MINION.waveIntervalTicks + 1);
    const marching = sim.q.minions.entities.find((m) => m.minion.type === 'beast')!;
    sim.dealDamage(marching, 1e6, null);
    run(sim, BEAST.respawnTicks - 5);
    expect(sim.q.monsters.entities.some((m) => m.monster.type === 'beast')).toBe(false);
    run(sim, 10);
    expect(sim.q.monsters.entities.some((m) => m.monster.type === 'beast')).toBe(true);
  });
});
