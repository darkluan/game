import { dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import type { Entity, ZoneEffect } from '../types.js';

const TRAP_TRIGGER_RADIUS = 1.2;
const BLIND_REFRESH_TICKS = 6;

export function spawnZone(
  sim: Sim,
  owner: Entity,
  at: { x: number; z: number },
  zone: { effect: ZoneEffect; radius: number; lifeTicks: number; everyTicks: number; value: number },
): void {
  sim.spawn({
    kind: 'zone',
    team: owner.team,
    pos: { x: at.x, z: at.z },
    radius: zone.radius,
    zone: {
      ownerId: owner.id,
      effect: zone.effect,
      untilTick: sim.tick + zone.lifeTicks,
      everyTicks: zone.everyTicks,
      value: zone.value,
    },
  });
}

/** Zones pulse, traps wait for a hero to step on them, turrets pick targets. All of them expire. */
export function summonSystem(sim: Sim): void {
  for (const z of sim.q.zones) {
    const zone = z.zone;
    if (sim.tick >= zone.untilTick) {
      z.dead = true;
      continue;
    }
    if ((zone.untilTick - sim.tick) % zone.everyTicks !== 0) continue;
    const owner = sim.get(zone.ownerId) ?? null;
    for (const e of sim.enemiesWithin(z.team, z.pos, z.radius)) {
      if (zone.effect === 'burn') sim.dealDamage(e, zone.value, owner);
      else if (e.hero) sim.addStatus(e, 'blind', BLIND_REFRESH_TICKS + zone.everyTicks);
    }
  }

  for (const t of sim.q.traps) {
    if (t.dead) continue;
    if (sim.tick >= t.trap.untilTick) {
      t.dead = true;
      continue;
    }
    const victim = sim.q.heroes.entities.find(
      (h) => h.team !== t.team && sim.isTargetable(h) && dist(h.pos, t.pos) <= TRAP_TRIGGER_RADIUS + h.radius,
    );
    if (!victim) continue;
    t.dead = true;
    sim.addStatus(victim, 'root', t.trap.rootTicks);
    sim.addStatus(victim, 'mark', t.trap.markTicks, t.trap.mark);
    sim.dealDamage(victim, t.trap.damage, sim.get(t.trap.ownerId) ?? null);
  }

  for (const t of sim.q.turrets) {
    if (t.dead) continue;
    if (sim.tick >= t.turret.untilTick) {
      t.dead = true;
      continue;
    }
    const a = t.attacker;
    const current = a.targetId === null ? undefined : sim.get(a.targetId);
    if (current && sim.isTargetable(current) && sim.canSee(t, current) && sim.inRange(t, current, a.range)) continue;
    a.targetId = sim.nearestEnemy(t, a.range)?.id ?? null;
  }
}
