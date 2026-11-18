import { RELIC } from '../data/balance.js';
import { dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import { type Entity, RELIC_TYPES, type RelicType, type Team } from '../types.js';

/** The relic buff a team currently holds, if any. */
export function teamRelic(sim: Sim, team: number): RelicType | null {
  return sim.buffs[team]?.relic ?? null;
}

function shieldFor(e: Entity): number {
  return e.tower ? RELIC.shield.tower : e.minion ? RELIC.shield.minion : 0;
}

/** The Shield relic covers an allied minion or tower for as long as the buff has left. */
export function applyRelicShield(sim: Sim, e: Entity): void {
  const buff = e.team === 0 || e.team === 1 ? sim.buffs[e.team] : null;
  const amount = shieldFor(e);
  if (buff?.relic === 'shield' && amount > 0) sim.addStatus(e, 'shield', buff.untilTick - sim.tick, amount);
}

function capture(sim: Sim, team: Team, relic: RelicType): void {
  sim.buffs[team] = { relic, untilTick: sim.tick + RELIC.buffTicks };
  sim.relic = null;
  sim.emit({ t: 'relicCaptured', team, relic });
  if (relic !== 'shield') return;
  for (const e of sim.q.units) if (e.team === team && !e.dead) applyRelicShield(sim, e);
}

/**
 * Every two minutes one random pedestal lights up with a random relic. A team captures it by keeping
 * a hero on the pedestal for five seconds; an enemy hero stepping on, or a hit from an enemy hero,
 * starts the count again.
 */
export function relicSystem(sim: Sim): void {
  for (const team of [0, 1] as const) {
    const buff = sim.buffs[team];
    if (buff && sim.tick >= buff.untilTick) {
      sim.buffs[team] = null;
      sim.emit({ t: 'relicExpired', team, relic: buff.relic });
    }
  }

  const since = sim.tick - RELIC.firstTick;
  if (since >= 0 && since % RELIC.intervalTicks === 0) {
    const pedestal = Math.floor(sim.rng.next() * sim.map.pedestals.length);
    const relic = RELIC_TYPES[Math.floor(sim.rng.next() * RELIC_TYPES.length)];
    sim.relic = { pedestal, type: relic, team: null, progress: 0 };
    sim.emit({ t: 'relicSpawn', pedestal, relic, ...sim.map.pedestals[pedestal] });
  }

  const relic = sim.relic;
  if (!relic) return;
  const at = sim.map.pedestals[relic.pedestal];
  const present = sim.q.heroes.entities.filter((h) => !h.dead && !sim.cannotAct(h) && dist(h.pos, at) <= RELIC.radius);
  const teams = new Set(present.map((h) => h.team));
  const holder = teams.size === 1 ? present[0].team : null;
  const disturbed = present.some((h) => h.hero.recentAttackers.some((a) => a.tick >= sim.tick - 1));
  if (holder === null || disturbed) {
    relic.team = holder;
    relic.progress = 0;
    return;
  }
  relic.progress = relic.team === holder ? relic.progress + 1 : 1;
  relic.team = holder;
  if (relic.progress >= RELIC.captureTicks) capture(sim, holder, relic.type);
}

/** Thunder relic: a hero's basic attack arcs from its target to the nearest other enemies. */
export function chainLightning(sim: Sim, source: Entity, target: Entity, attackDamage: number): void {
  if (!source.hero || teamRelic(sim, source.team) !== 'thunder') return;
  const { targets, range, damagePct } = RELIC.thunder;
  const near = sim
    .enemiesWithin(source.team, target.pos, range)
    .filter((e) => e !== target)
    .sort((a, b) => dist(a.pos, target.pos) - dist(b.pos, target.pos) || a.id - b.id)
    .slice(0, targets);
  for (const e of near) {
    sim.emit({ t: 'lightning', x1: target.pos.x, z1: target.pos.z, x2: e.pos.x, z2: e.pos.z });
    sim.dealDamage(e, attackDamage * damagePct, source);
  }
}
