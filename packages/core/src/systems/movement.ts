import { HERO, TICK_RATE } from '../data/balance.js';
import { angleTo, clamp, dist } from '../math.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { Entity, Vec2 } from '../types.js';
import { speedFactor } from './combat.js';
import { isFlying } from './stats.js';

/** Step straight toward a point. Returns true on arrival. */
export function moveToward(sim: Sim, e: Entity, to: Vec2, speed: number): boolean {
  const step = (speed * speedFactor(sim, e)) / TICK_RATE;
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

/** Waypoints for a hero to reach a point. Flying heroes go straight over walls. */
export function pathFor(sim: Sim, h: HeroEntity, to: Vec2): Vec2[] {
  return isFlying(sim, h) ? [sim.nav.nearestWalkable(to)] : sim.nav.findPath(h.pos, to);
}

function followPath(sim: Sim, e: HeroEntity): void {
  const path = e.mover.path;
  if (path.length > 0 && moveToward(sim, e, path[0], e.mover.speed)) path.shift();
}

/** Turns each hero's standing order (idle / move / attack) into movement and an attack target. */
export function heroOrderSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    if (h.dead || sim.cannotAct(h)) continue;
    const order = h.hero.order;
    const a = h.attacker;
    // Channelling a recall: stand still and pick no fights.
    if (h.hero.recallAt > 0) {
      a.targetId = null;
      continue;
    }
    const rooted = sim.cannotMove(h);

    if (order.t === 'move') {
      a.targetId = null;
      if (rooted) continue;
      followPath(sim, h);
      if (h.mover.path.length === 0) h.hero.order = { t: 'idle' };
      continue;
    }

    let target: Entity | null = null;
    if (order.t === 'attack') {
      target = sim.get(order.targetId) ?? null;
      if (!target || !sim.isTargetable(target) || !sim.canSee(h, target)) {
        h.hero.order = { t: 'idle' };
        target = null;
      }
    }
    if (!target && !sim.hasStatus(h, 'stealth')) {
      // Idle: keep the current target while it stays close, else look for a new one nearby.
      // Monsters are only fought back, never picked on. A hidden hero does not give itself away.
      const leash = a.range + HERO.idleAcquireBonus;
      const current = a.targetId === null ? null : (sim.get(a.targetId) ?? null);
      target =
        current && sim.isTargetable(current) && sim.canSee(h, current) && sim.inRange(h, current, leash)
          ? current
          : (sim.nearestEnemy(h, leash) ?? sim.nearestEnemy(h, leash, (e) => e.monster?.aggroId === h.id, true));
    }
    a.targetId = target?.id ?? null;
    if (!target || sim.inRange(h, target, a.range) || rooted) {
      h.mover.path = [];
      continue;
    }
    if (h.mover.path.length === 0 || (sim.tick + h.id) % 5 === 0) h.mover.path = pathFor(sim, h, target.pos);
    followPath(sim, h);
  }
}

function pushApart(a: Entity, b: Entity, min: number, moveA: boolean): void {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  if (d >= min) return;
  // Exactly stacked: split along z by id so the result stays deterministic.
  const nx = d > 1e-6 ? dx / d : 0;
  const nz = d > 1e-6 ? dz / d : 1;
  const push = moveA ? (min - d) / 2 : min - d;
  if (moveA) {
    a.pos.x -= nx * push;
    a.pos.z -= nz * push;
  }
  b.pos.x += nx * push;
  b.pos.z += nz * push;
}

/** Keeps minions from stacking, keeps them out of buildings, and makes a petrified hero block the way. */
export function separationSystem(sim: Sim): void {
  const minions = sim.q.minions.entities.filter((m) => !m.dead).sort((a, b) => a.id - b.id);
  for (let i = 0; i < minions.length; i++) {
    for (let j = i + 1; j < minions.length; j++) {
      pushApart(minions[i], minions[j], minions[i].radius + minions[j].radius, true);
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
  }
  for (const stone of sim.q.heroes) {
    if (stone.dead || !sim.hasStatus(stone, 'stone')) continue;
    for (const e of sim.q.units) {
      if (e.team === stone.team || e.dead || !e.mover) continue;
      const before = { x: e.pos.x, z: e.pos.z };
      pushApart(stone, e, stone.radius + e.radius + 1.2, false);
      if (!sim.nav.isWalkable(e.pos.x, e.pos.z)) Object.assign(e.pos, before);
    }
  }
  for (const m of minions) {
    m.pos.x = clamp(m.pos.x, -sim.map.halfWidth, sim.map.halfWidth);
    m.pos.z = clamp(m.pos.z, -sim.map.halfDepth, sim.map.halfDepth);
  }
}
