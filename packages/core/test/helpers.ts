import { Sim, type Entity, type HeroEntity, type PlayerSetup } from '../src/index.js';

export const duel: PlayerSetup[] = [
  { playerId: 'a', team: 0, heroId: 'kael', isBot: false },
  { playerId: 'b', team: 1, heroId: 'kael', isBot: false },
];

export function makeSim(players: PlayerSetup[] = duel, seed = 1): Sim {
  return new Sim({ seed, players });
}

export function hero(sim: Sim, playerId: string): HeroEntity {
  const h = sim.heroOf(playerId);
  if (!h) throw new Error(`no hero for ${playerId}`);
  return h;
}

export function place(e: Entity, x: number, z: number, facing = e.facing): void {
  e.pos.x = x;
  e.pos.z = z;
  e.facing = facing;
}

export function run(sim: Sim, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step();
}

/** Facing angles: toward +x and toward -x. */
export const EAST = Math.PI / 2;
export const WEST = -Math.PI / 2;

/** Two heroes face to face mid-lane, level 12 with one point in every ability. */
export function arena(heroA = 'kael', heroB = 'kael', gap = 2.5) {
  const sim = new Sim({
    seed: 1,
    players: [
      { playerId: 'a', team: 0, heroId: heroA, isBot: false },
      { playerId: 'b', team: 1, heroId: heroB, isBot: false },
    ],
  });
  const a = hero(sim, 'a');
  const b = hero(sim, 'b');
  for (const h of [a, b]) {
    h.hero.level = 12;
    h.hero.skillPoints = 0;
    h.hero.abilityLevels = { Q: 1, W: 1, E: 1, R: 1 };
  }
  place(a, 0, 0, EAST);
  place(b, gap, 0, WEST);
  sim.step();
  a.health.hp = a.health.maxHp;
  b.health.hp = b.health.maxHp;
  // Keep basic attacks out of the way so tests measure abilities alone; a test that wants
  // attacks sets the cooldown back to 0.
  for (const h of [a, b]) h.attacker.cooldown = 1e9;
  for (const p of sim.q.projectiles) p.dead = true;
  /** Cast a's ability at b (or at a point) and run one tick. */
  const cast = (slot: 'Q' | 'W' | 'E' | 'R', at: { x: number; z: number } = b.pos, by: 'a' | 'b' = 'a') => {
    const target = by === 'a' ? b : a;
    sim.command(by, { t: 'cast', slot, x: at.x, z: at.z, targetId: target.id });
    sim.step();
    return sim.events;
  };
  return { sim, a, b, cast };
}
