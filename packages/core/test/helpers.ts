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
