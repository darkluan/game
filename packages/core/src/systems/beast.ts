import { BEAST, MINION } from '../data/balance.js';
import type { Sim } from '../sim/Sim.js';
import { type Entity, NEUTRAL, type Team } from '../types.js';

/** The marching Beast walks beside the lane's centre line, clear of the towers standing on it. */
const MARCH_LANE_Z = 3.4;

/** The Ancient Beast appears in its cave at minute seven, and again some time after a march ends. */
export function beastSystem(sim: Sim): void {
  if (sim.tick < sim.beast.respawnAt) return;
  sim.beast.respawnAt = Infinity;
  const stats = BEAST.wild;
  const home = { ...sim.map.beastCave };
  sim.spawn({
    kind: 'monster',
    team: NEUTRAL,
    pos: { ...home },
    radius: stats.radius,
    health: { hp: stats.hp, maxHp: stats.hp, armor: stats.armor },
    statuses: [],
    mover: { speed: MINION.speed, path: [] },
    attacker: {
      damage: stats.attack,
      range: stats.range,
      intervalTicks: stats.intervalTicks,
      cooldown: 0,
      projectileSpeed: 0,
      targetId: null,
    },
    monster: { type: 'beast', camp: -1, home, aggroId: null },
  });
  sim.emit({ t: 'beastSpawn', x: home.x, z: home.z });
}

/** The wild Beast died: the killer's team will have it march with their next wave. */
export function onBeastSlain(sim: Sim, killer: Entity | null): void {
  const team = killer?.team === 0 || killer?.team === 1 ? killer.team : null;
  sim.beast.owner = team;
  // Nobody to march for (it was not killed by a team): it simply comes back later.
  if (team === null) sim.beast.respawnAt = sim.tick + BEAST.respawnTicks;
  sim.emit({ t: 'beastSlain', team });
}

/** Called when a wave spawns: the team that slew the Beast gets it at the head of this wave. */
export function spawnMarchingBeast(sim: Sim, team: Team): void {
  if (sim.beast.owner !== team) return;
  sim.beast.owner = null;
  const stats = BEAST.march;
  const spawn = sim.map.minionSpawns[team];
  const dir = team === 0 ? 1 : -1;
  sim.spawn({
    kind: 'minion',
    team,
    pos: { x: spawn.x + dir * 2, z: spawn.z + MARCH_LANE_Z },
    radius: stats.radius,
    facing: (dir * Math.PI) / 2,
    health: { hp: stats.hp, maxHp: stats.hp, armor: stats.armor },
    statuses: [],
    mover: { speed: stats.speed, path: [] },
    attacker: {
      damage: stats.attack,
      range: stats.range,
      intervalTicks: stats.intervalTicks,
      cooldown: 0,
      projectileSpeed: 0,
      targetId: null,
    },
    minion: { type: 'beast', laneZ: MARCH_LANE_Z },
  });
  sim.emit({ t: 'beastMarch', team });
}

/** The marching Beast fell: a new one will appear in the cave after a while. */
export function onMarchingBeastDeath(sim: Sim): void {
  sim.beast.respawnAt = sim.tick + BEAST.respawnTicks;
}

/** The marching Beast tears down buildings much faster than it hurts units. */
export function structureBonus(attacker: Entity, target: Entity): number {
  return attacker.minion?.type === 'beast' && (target.tower || target.shrine) ? BEAST.march.structureMult : 1;
}
