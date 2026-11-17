import { HERO, TICK_RATE } from '../data/balance.js';
import { angleTo, clamp, dist } from '../math.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { Entity, Vec2 } from '../types.js';
import { slowFactor } from './combat.js';

/** Step straight toward a point. Returns true on arrival. */
export function moveToward(e: Entity, to: Vec2, speed: number): boolean {
  const step = (speed * slowFactor(e)) / TICK_RATE;
  const d = dist(e.pos, to);
  if (d > 1e-6) e.facing = angleTo(e.pos, to);
  if (d <= step) {
    e.pos.x = to.x;
    e.pos.z = to.z;
    return true;
  }
  e.pos.x += ((to.x - e.pos.x) / d) * step;
  e.pos.z += ((to.z - e.pos.z) / d) * step;
  return false;
}

function followPath(e: HeroEntity): void {
  const path = e.mover.path;
  if (path.length > 0 && moveToward(e, path[0], e.mover.speed)) path.shift();
}

/** Turns each hero's standing order (idle / move / attack) into movement and an attack target. */
export function heroOrderSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    if (h.dead || sim.hasStatus(h, 'stun')) continue;
    const order = h.hero.order;
    const a = h.attacker;

    if (order.t === 'move') {
      a.targetId = null;
      followPath(h);
      if (h.mover.path.length === 0) h.hero.order = { t: 'idle' };
      continue;
    }

    let target: Entity | null = null;
    if (order.t === 'attack') {
      target = sim.get(order.targetId) ?? null;
      if (!target || !sim.isTargetable(target)) {
        h.hero.order = { t: 'idle' };
        target = null;
      }
    }
    if (!target) {
      // Idle: keep the current target while it stays close, else look for a new one nearby.
      const leash = a.range + HERO.idleAcquireBonus;
      const current = a.targetId === null ? null : (sim.get(a.targetId) ?? null);
      target =
        current && sim.isTargetable(current) && sim.inRange(h, current, leash) ? current : sim.nearestEnemy(h, leash);
    }
    a.targetId = target?.id ?? null;
    if (!target || sim.inRange(h, target, a.range)) {
      h.mover.path = [];
      continue;
    }
    if (h.mover.path.length === 0 || (sim.tick + h.id) % 5 === 0) h.mover.path = sim.nav.findPath(h.pos, target.pos);
    followPath(h);
  }
}

/** Keeps minions from stacking on each other and from walking through buildings. */
export function separationSystem(sim: Sim): void {
  const minions = sim.q.minions.entities.filter((m) => !m.dead).sort((a, b) => a.id - b.id);
  for (let i = 0; i < minions.length; i++) {
    for (let j = i + 1; j < minions.length; j++) {
      const a = minions[i];
      const b = minions[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const min = a.radius + b.radius;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      // Exactly stacked: split along z by id so the result stays deterministic.
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 1;
      const push = (min - d) / 2;
      a.pos.x -= nx * push;
      a.pos.z -= nz * push;
      b.pos.x += nx * push;
      b.pos.z += nz * push;
    }
  }
  const buildings = sim.world.entities.filter((e) => (e.kind === 'tower' || e.kind === 'shrine') && !e.dead);
  for (const m of minions) {
    for (const b of buildings) {
      const min = b.radius + m.radius;
      const dx = m.pos.x - b.pos.x;
      const dz = m.pos.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      // Dead centre: slide out sideways, on the side of the minion's lane slot.
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : m.minion.laneZ >= 0 ? 1 : -1;
      m.pos.x = b.pos.x + nx * min;
      m.pos.z = b.pos.z + nz * min;
    }
    m.pos.x = clamp(m.pos.x, -sim.map.halfWidth, sim.map.halfWidth);
    m.pos.z = clamp(m.pos.z, -sim.map.halfDepth, sim.map.halfDepth);
  }
}
