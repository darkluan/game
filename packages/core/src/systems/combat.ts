import { TICK_RATE } from '../data/balance.js';
import { angleTo, dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import type { Entity } from '../types.js';

export function statusSystem(sim: Sim): void {
  for (const e of sim.q.units) {
    if (e.statuses.length > 0) e.statuses = e.statuses.filter((s) => s.untilTick > sim.tick);
  }
}

/** Speed multiplier from the strongest slow on the entity. */
export function slowFactor(e: Entity): number {
  let slow = 0;
  for (const s of e.statuses ?? []) if (s.type === 'slow' && s.value > slow) slow = s.value;
  return 1 - slow;
}

/** Everything with an attacker component hits its current target when in range and off cooldown. */
export function attackSystem(sim: Sim): void {
  for (const e of sim.q.attackers) {
    const a = e.attacker;
    if (a.cooldown > 0) a.cooldown--;
    if (e.dead || a.targetId === null) continue;
    const target = sim.get(a.targetId);
    if (!target || !sim.isTargetable(target)) {
      a.targetId = null;
      continue;
    }
    if (sim.hasStatus(e, 'stun') || !sim.inRange(e, target, a.range)) continue;
    e.facing = angleTo(e.pos, target.pos);
    if (a.cooldown > 0) continue;
    a.cooldown = a.intervalTicks;
    sim.emit({ t: 'attack', sourceId: e.id, targetId: target.id });
    if (a.projectileSpeed > 0) sim.spawnProjectile(e, target, a.damage, a.projectileSpeed);
    else sim.dealDamage(target, a.damage, e);
  }
}

/** Projectiles home in on their target and vanish if it dies first. */
export function projectileSystem(sim: Sim): void {
  for (const p of sim.q.projectiles) {
    if (p.dead) continue;
    const target = sim.get(p.projectile.targetId);
    if (!target || !sim.isAlive(target)) {
      p.dead = true;
      continue;
    }
    const d = dist(p.pos, target.pos);
    const step = p.projectile.speed / TICK_RATE;
    if (d <= step + target.radius * 0.5) {
      p.dead = true;
      sim.dealDamage(target, p.projectile.damage, sim.get(p.projectile.sourceId) ?? null);
    } else {
      p.pos.x += ((target.pos.x - p.pos.x) / d) * step;
      p.pos.z += ((target.pos.z - p.pos.z) / d) * step;
    }
  }
}
