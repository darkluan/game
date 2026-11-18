import { describe, expect, it } from 'vitest';
import {
  HEAT,
  HEROES,
  ITEMS,
  seconds,
  Sim,
  SYNERGY,
  synergyOf,
  youSnapshotOf,
  type PlayerSetup,
} from '../src/index.js';
import { hero, place, run } from './helpers.js';

/** Team 0 plays the given heroes; team 1 is a lone Kael far away. */
function team(heroIds: string[]): Sim {
  const players: PlayerSetup[] = heroIds.map((heroId, i) => ({ playerId: `p${i}`, team: 0, heroId, isBot: false }));
  players.push({ playerId: 'foe', team: 1, heroId: 'kael', isBot: false });
  const sim = new Sim({ seed: 1, players });
  sim.step();
  return sim;
}

describe('synergyOf', () => {
  it('rewards three different races with speed, and a pair with its race', () => {
    expect(synergyOf(['human', 'dragon', 'god'])).toEqual({ speed: true, race: null });
    expect(synergyOf(['dragon', 'human', 'dragon'])).toEqual({ speed: false, race: 'dragon' });
    expect(synergyOf(['human', 'dragon'])).toEqual({ speed: false, race: null });
    expect(synergyOf([])).toEqual({ speed: false, race: null });
  });
});

describe('race synergy in a match', () => {
  it('three different races: the whole team moves faster', () => {
    const mixed = hero(team(['kael', 'ignar', 'sola']), 'p0');
    const paired = hero(team(['kael', 'lyra', 'sola']), 'p0');
    expect(mixed.mover.speed).toBeCloseTo(HEROES.kael.base.moveSpeed * (1 + SYNERGY.speed));
    expect(paired.mover.speed).toBe(HEROES.kael.base.moveSpeed);
  });

  it('two dragons evolve one level earlier', () => {
    const stageAt = (heroIds: string[], level: number) => {
      const sim = team(heroIds);
      const dragon = hero(sim, 'p0');
      dragon.hero.level = level;
      sim.step();
      return dragon.hero.stage;
    };
    expect(stageAt(['ignar', 'baru', 'kael'], 4)).toBe(1);
    expect(stageAt(['ignar', 'kael', 'sola'], 4)).toBe(0);
    expect(stageAt(['ignar', 'baru', 'kael'], 8)).toBe(2);
  });

  it('two machines cool down faster', () => {
    const heatAfter = (heroIds: string[]) => {
      const sim = team(heroIds);
      const bolt = hero(sim, 'p0');
      bolt.hero.heat = 80;
      run(sim, HEAT.decayDelayTicks + seconds(2));
      return bolt.hero.heat;
    };
    const alone = 80 - heatAfter(['bolt7', 'kael', 'sola']);
    const paired = 80 - heatAfter(['bolt7', 'mekka', 'kael']);
    expect(paired / alone).toBeCloseTo(SYNERGY.machineDecayMult, 1);
  });

  it('two gods get more from each follower', () => {
    const attackWithFollowers = (heroIds: string[]) => {
      const sim = team(heroIds);
      const sola = hero(sim, 'p0');
      const base = sola.attacker.damage;
      run(sim, seconds(6)); // first wave is out
      sim.q.minions.entities.filter((m) => m.team === 0).forEach((m, i) => place(m, sola.pos.x + 1, i - 2));
      sim.step();
      return sola.attacker.damage / base;
    };
    const alone = attackWithFollowers(['sola', 'kael', 'ignar']) - 1;
    const paired = attackWithFollowers(['sola', 'vesper', 'kael']) - 1;
    expect(paired / alone).toBeCloseTo(SYNERGY.godFollowerMult, 2);
  });

  it('two humans shop at 20% off, and the snapshot tells the player', () => {
    const sim = team(['kael', 'lyra', 'ignar']);
    const kael = hero(sim, 'p0');
    kael.hero.gold = 1000;
    sim.command('p0', { t: 'buy', itemId: 'iron_sword' });
    sim.step();
    expect(1000 - kael.hero.gold).toBe(ITEMS.iron_sword.cost * (1 - SYNERGY.humanDiscount));
    expect(youSnapshotOf(sim, kael)).toMatchObject({ discount: 0.2, synergy: { speed: false, race: 'human' } });
    // The dragon on the same team pays full price.
    expect(youSnapshotOf(sim, hero(sim, 'p2')).discount).toBe(0);
  });
});
