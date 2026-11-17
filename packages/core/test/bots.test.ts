import { describe, expect, it } from 'vitest';
import { HERO_IDS, MVP_HERO_IDS, Sim, type PlayerSetup } from '../src/index.js';
import { run } from './helpers.js';

/** Three bots a side, heroes taken in order from the given list. */
function lineup(heroIds: readonly string[]): PlayerSetup[] {
  return [0, 1].flatMap((team) =>
    [0, 1, 2].map((i) => ({
      playerId: `bot-${team}-${i}`,
      team: team as 0 | 1,
      heroId: heroIds[(team * 3 + i) % heroIds.length],
      isBot: true,
    })),
  );
}

function playOut(seed: number, heroIds: readonly string[]): Sim {
  const sim = new Sim({ seed, players: lineup(heroIds) });
  const limit = 20 * 60 * 45;
  while (sim.winner === null && sim.tick < limit) sim.step();
  return sim;
}

describe('bots with every hero', () => {
  it('finish a match with the four MVP heroes', () => {
    const sim = playOut(11, MVP_HERO_IDS);
    console.info(`MVP bot match: team ${sim.winner} wins after ${(sim.tick / 1200).toFixed(1)} min`);
    expect(sim.winner).not.toBeNull();
  });

  it('finish a match with all eight heroes in play', () => {
    const sim = playOut(5, [...HERO_IDS.slice(0, 3), ...HERO_IDS.slice(3, 8)].slice(0, 6).concat(HERO_IDS.slice(6)));
    const other = playOut(5, HERO_IDS.slice(2));
    for (const s of [sim, other]) {
      const heroes = s.q.heroes.entities;
      console.info(
        `bot match (${heroes.map((h) => h.hero.defId).join(', ')}): team ${s.winner} wins after ${(s.tick / 1200).toFixed(1)} min`,
      );
      expect(s.winner).not.toBeNull();
    }
  });

  it('buy items, level abilities, kill each other and use every kind of ability', () => {
    const sim = new Sim({ seed: 3, players: lineup(HERO_IDS.slice(2)) });
    const cast = new Set<string>();
    for (let i = 0; i < 20 * 60 * 6 && sim.winner === null; i++) {
      sim.step();
      for (const e of sim.events) if (e.t === 'cast') cast.add(e.abilityId);
    }
    const heroes = sim.q.heroes.entities;
    expect(heroes.every((h) => h.hero.items.length > 0)).toBe(true);
    expect(heroes.every((h) => h.hero.skillPoints === 0)).toBe(true);
    expect(heroes.reduce((n, h) => n + h.hero.kills, 0)).toBeGreaterThan(0);
    // Each of the six heroes got at least three of its four abilities off.
    for (const h of heroes) {
      const used = [...cast].filter((id) => id.startsWith(h.hero.defId.replace('7', '') + '_')).length;
      expect(used, `${h.hero.defId} used ${used}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('replay identically from the same seed with mixed heroes', () => {
    const play = (seed: number) => {
      const sim = new Sim({ seed, players: lineup(HERO_IDS) });
      run(sim, 20 * 120);
      return sim.hash();
    };
    expect(play(9)).toBe(play(9));
  });
});
