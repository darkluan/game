import { VISION } from '../data/balance.js';
import { bushAt } from '../data/map.js';
import { dist } from '../math.js';
import type { Sim } from '../sim/Sim.js';
import type { Entity, Team } from '../types.js';

/** True when some living hero or minion of `team` satisfies `test`. Towers do not scout. */
function anyScout(sim: Sim, team: Team, test: (scout: Entity) => boolean): boolean {
  for (const h of sim.q.heroes) if (h.team === team && !h.dead && test(h)) return true;
  for (const m of sim.q.minions) if (m.team === team && !m.dead && test(m)) return true;
  return false;
}

/**
 * Whether `team` sees an enemy entity. Everything is visible except: traps (seen only from up close),
 * stealthed units, and units standing in a bush that nobody of `team` shares.
 * A marked unit can never hide.
 */
export function computeVisible(sim: Sim, e: Entity, team: Team): boolean {
  if (e.kind === 'tower' || e.kind === 'shrine' || e.kind === 'projectile' || e.kind === 'zone') return true;
  if (e.trap) return anyScout(sim, team, (s) => s.kind === 'hero' && dist(s.pos, e.pos) <= VISION.trapRevealRange);
  if (sim.hasStatus(e, 'mark')) return true;
  const close = (s: Entity) => dist(s.pos, e.pos) <= VISION.revealRange;
  if (sim.hasStatus(e, 'stealth')) return anyScout(sim, team, close);
  const bush = bushAt(sim.map, e.pos);
  if (bush < 0) return true;
  return anyScout(sim, team, (s) => bushAt(sim.map, s.pos) === bush || close(s));
}

/** A unit sees what its team sees, except a blinded unit only sees enemies right next to it. */
export function computeCanSee(sim: Sim, viewer: Entity, e: Entity): boolean {
  if (viewer.team === e.team) return true;
  if (!sim.isVisibleTo(e, viewer.team)) return false;
  return !sim.hasStatus(viewer, 'blind') || dist(viewer.pos, e.pos) <= VISION.blindRange + e.radius;
}
