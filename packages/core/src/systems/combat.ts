import { TICK_RATE } from '../data/balance.js';
import { itemTotals } from '../data/items.js';
import { angleTo, dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import type { Entity } from '../types.js';

/** Expires statuses and applies damage over time once a second. */
export function statusSystem(sim: Sim): void {
  const burnTick = sim.tick % TICK_RATE === 0;
  for (const e of sim.q.units) {
    if (e.statuses.length === 0) continue;
    if (burnTick && !e.dead) {
      for (const s of [...e.statuses]) {
        if (s.type === 'burn')
          sim.dealDamage(e, s.value, s.sourceId === undefined ? null : (sim.get(s.sourceId) ?? null));
      }
    }
    e.statuses = e.statuses.filter((s) => s.untilTick > sim.tick);
  }
}

/** Movement speed multiplier from the strongest slow and the summed hastes. */
export function speedFactor(sim: Sim, e: Entity): number {
  return (1 - sim.statusMax(e, 'slow')) * (1 + sim.statusSum(e, 'haste'));
}

/** Basic attack damage including temporary attack buffs. */
export function attackDamageOf(sim: Sim, e: Entity): number {
  return (e.attacker?.damage ?? 0) * (1 + sim.statusSum(e, 'attack'));
}

function onBasicHit(sim: Sim, source: Entity | null, dealt: number): void {
  if (!source?.hero || dealt <= 0) return;
  const lifesteal = itemTotals(source.hero.items).lifesteal;
  if (lifesteal > 0) sim.heal(source, dealt * lifesteal);
}

/** Everything with an attacker component hits its current target when in range and off cooldown. */
export function attackSystem(sim: Sim): void {
  for (const e of sim.q.attackers) {
    const a = e.attacker;
    if (a.cooldown > 0) a.cooldown--;
    if (e.dead || a.targetId === null) continue;
    const target = sim.get(a.targetId);
    if (!target || !sim.isTargetable(target) || !sim.canSee(e, target)) {
      a.targetId = null;
      continue;
    }
    if (sim.cannotAct(e) || !sim.inRange(e, target, a.range)) continue;
    e.facing = angleTo(e.pos, target.pos);
    if (a.cooldown > 0) continue;
    a.cooldown = a.intervalTicks;
    sim.removeStatus(e, 'stealth');
    sim.emit({ t: 'attack', sourceId: e.id, targetId: target.id });
    const damage = attackDamageOf(sim, e);
    if (a.projectileSpeed > 0) sim.spawnProjectile(e, target, damage, a.projectileSpeed);
    else onBasicHit(sim, e, sim.dealDamage(target, damage, e));
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
      const source = sim.get(p.projectile.sourceId) ?? null;
      onBasicHit(sim, source, sim.dealDamage(target, p.projectile.damage, source));
    } else {
      p.pos.x += ((target.pos.x - p.pos.x) / d) * step;
      p.pos.z += ((target.pos.z - p.pos.z) / d) * step;
    }
  }
}
