import { JUNGLE, TICK_RATE } from '../data/balance.js';
import { dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import { NEUTRAL } from '../types.js';
import { moveToward } from './movement.js';

function spawnCamp(sim: Sim, camp: number): void {
  const def = sim.map.camps[camp];
  for (const m of def.monsters) {
    const stats = JUNGLE[m.type];
    const home = { x: def.pos.x + m.dx, z: def.pos.z + m.dz };
    sim.spawn({
      kind: 'monster',
      team: NEUTRAL,
      pos: { ...home },
      radius: stats.radius,
      // Face the lane.
      facing: home.z > 0 ? Math.PI : 0,
      health: { hp: stats.hp, maxHp: stats.hp, armor: stats.armor },
      statuses: [],
      mover: { speed: JUNGLE.speed, path: [] },
      attacker: {
        damage: stats.attack,
        range: stats.range,
        intervalTicks: stats.intervalTicks,
        cooldown: 0,
        projectileSpeed: 0,
        targetId: null,
      },
      monster: { type: m.type, camp, home, aggroId: null },
    });
  }
  sim.camps[camp].alive = def.monsters.length;
}

/** Jungle camps: monsters wait at home, fight whoever hits them, give up when dragged away, and respawn. */
export function jungleSystem(sim: Sim): void {
  sim.camps.forEach((camp, i) => {
    if (camp.alive === 0 && sim.tick >= camp.respawnAt) spawnCamp(sim, i);
  });
  for (const m of sim.q.monsters) {
    if (m.dead || sim.cannotAct(m)) continue;
    const state = m.monster;
    let target = state.aggroId === null ? undefined : sim.get(state.aggroId);
    const tooFar = dist(m.pos, state.home) > JUNGLE.leash;
    if (
      !target ||
      !sim.isTargetable(target) ||
      !sim.canSee(m, target) ||
      tooFar ||
      dist(target.pos, state.home) > JUNGLE.leash + 4
    ) {
      target = undefined;
      state.aggroId = null;
    }
    m.attacker.targetId = target?.id ?? null;
    if (target) {
      if (!sim.inRange(m, target, m.attacker.range) && !sim.cannotMove(m))
        moveToward(sim, m, target.pos, m.mover.speed);
    } else if (dist(m.pos, state.home) > 0.05 || m.health.hp < m.health.maxHp) {
      // Walk home and recover, so a camp cannot be whittled down by hit and run.
      if (!sim.cannotMove(m)) moveToward(sim, m, state.home, m.mover.speed);
      m.health.hp = Math.min(m.health.maxHp, m.health.hp + (m.health.maxHp * JUNGLE.homeRegen) / TICK_RATE);
    }
  }
}
