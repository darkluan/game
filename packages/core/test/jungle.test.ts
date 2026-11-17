import { describe, expect, it } from 'vitest';
import { JUNGLE, MAP, NEUTRAL, seconds } from '../src/index.js';
import { arena, place, run } from './helpers.js';

function withCamps() {
  // Hero a waits in its base, out of the lane fighting, until the camps are up.
  const game = arena('kael', 'kael', 40);
  place(game.a, -50, 10);
  run(game.sim, JUNGLE.firstSpawnTick + 1);
  const camp = MAP.camps[0];
  const monsters = () => game.sim.q.monsters.entities.filter((m) => m.monster.camp === 0 && !m.dead);
  return { ...game, camp, monsters, big: monsters().find((m) => m.monster.type === 'big')! };
}

describe('jungle camps', () => {
  it('spawn four camps of one big and two small monsters', () => {
    const { sim } = withCamps();
    const all = sim.q.monsters.entities;
    expect(all).toHaveLength(12);
    expect(all.filter((m) => m.monster.type === 'big')).toHaveLength(4);
    expect(all.every((m) => m.team === NEUTRAL)).toBe(true);
  });

  it('leave passers-by alone and are not auto-attacked', () => {
    const { sim, a, camp, monsters } = withCamps();
    place(a, camp.pos.x, camp.pos.z - 2);
    a.attacker.cooldown = 0;
    a.health.hp = a.health.maxHp;
    run(sim, seconds(2));
    expect(a.health.hp).toBe(a.health.maxHp);
    expect(monsters().every((m) => m.health.hp === m.health.maxHp)).toBe(true);
  });

  it('fight back as a camp when one of them is hit', () => {
    const { sim, a, camp, monsters, big } = withCamps();
    place(a, camp.pos.x, camp.pos.z - 2);
    a.attacker.cooldown = 0;
    sim.command('a', { t: 'attack', targetId: big.id });
    run(sim, seconds(3));
    expect(monsters().every((m) => m.monster.aggroId === a.id)).toBe(true);
    expect(a.health.hp).toBeLessThan(a.health.maxHp);
    expect(big.health.hp).toBeLessThan(big.health.maxHp);
  });

  it('give up, walk home and recover when dragged too far', () => {
    const { sim, a, camp, big } = withCamps();
    place(a, camp.pos.x, camp.pos.z - 2);
    sim.dealDamage(big, 300, a);
    place(a, camp.pos.x + 25, camp.pos.z);
    run(sim, seconds(6));
    expect(big.monster.aggroId).toBeNull();
    expect(big.pos.x).toBeCloseTo(big.monster.home.x, 0);
    expect(big.health.hp).toBe(big.health.maxHp);
  });

  it('pay gold and xp, and come back a minute after the camp is cleared', () => {
    const { sim, a, camp, monsters } = withCamps();
    place(a, camp.pos.x, camp.pos.z - 2);
    a.hero.level = 1;
    const gold = a.hero.gold;
    for (const m of monsters()) sim.dealDamage(m, 1e6, a);
    expect(a.hero.gold - gold).toBe(JUNGLE.big.gold + 2 * JUNGLE.small.gold);
    expect(a.hero.level).toBeGreaterThan(1);
    sim.step();
    expect(monsters()).toHaveLength(0);
    run(sim, JUNGLE.respawnTicks - 5);
    expect(monsters()).toHaveLength(0);
    run(sim, 10);
    expect(monsters()).toHaveLength(3);
  });
});
