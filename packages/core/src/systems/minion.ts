import { MINION } from '../data/balance.js';
import type { Sim } from '../sim/Sim.js';
import type { Team } from '../types.js';
import { moveToward } from './movement.js';

function spawnMinion(sim: Sim, team: Team, type: 'melee' | 'ranged', laneZ: number): void {
  const stats = MINION[type];
  const spawn = sim.map.minionSpawns[team];
  const dir = team === 0 ? 1 : -1;
  sim.spawn({
    kind: 'minion',
    team,
    // Ranged minions start a step behind the melee line. A little jitter keeps waves from being identical.
    pos: { x: spawn.x - (type === 'ranged' ? dir * 2 : 0) + sim.rng.range(-0.4, 0.4), z: spawn.z + laneZ },
    radius: stats.radius,
    facing: (dir * Math.PI) / 2,
    health: { hp: stats.hp, maxHp: stats.hp, armor: stats.armor },
    statuses: [],
    mover: { speed: MINION.speed, path: [] },
    attacker: {
      damage: stats.attack,
      range: stats.range,
      intervalTicks: stats.intervalTicks,
      cooldown: 0,
      projectileSpeed: stats.projectileSpeed,
      targetId: null,
    },
    minion: { type, laneZ },
  });
}

export function minionSpawnSystem(sim: Sim): void {
  const sinceFirst = sim.tick - MINION.firstWaveTick;
  if (sinceFirst < 0 || sinceFirst % MINION.waveIntervalTicks !== 0) return;
  for (const team of [0, 1] as const) {
    for (let i = 0; i < MINION.meleePerWave; i++) spawnMinion(sim, team, 'melee', sim.map.laneOffsets.melee[i] ?? 0);
    for (let i = 0; i < MINION.rangedPerWave; i++) spawnMinion(sim, team, 'ranged', sim.map.laneOffsets.ranged[i] ?? 0);
  }
}

/** Minions march down the lane and fight the nearest enemy they meet. */
export function minionSystem(sim: Sim): void {
  for (const m of sim.q.minions) {
    if (m.dead || sim.hasStatus(m, 'stun')) continue;
    const a = m.attacker;
    let target = a.targetId === null ? undefined : sim.get(a.targetId);
    if (!target || !sim.isTargetable(target) || !sim.inRange(m, target, MINION.aggroRange + 2)) {
      target = sim.nearestEnemy(m, MINION.aggroRange) ?? undefined;
      a.targetId = target?.id ?? null;
    }
    if (target) {
      if (!sim.inRange(m, target, a.range)) moveToward(m, target.pos, m.mover.speed);
    } else {
      moveToward(m, { x: sim.map.shrines[m.team === 0 ? 1 : 0].x, z: m.minion.laneZ }, m.mover.speed);
    }
  }
}
