import { TOWER } from '../data/balance.js';
import type { Sim } from '../sim/Sim.js';

/**
 * Towers shoot minions first. A hero that hits an allied hero inside the tower's range
 * becomes the target right away.
 */
export function towerSystem(sim: Sim): void {
  for (const t of sim.q.towers) {
    if (t.dead) continue;
    const a = t.attacker;
    const aggressor = sim.nearestEnemy(
      t,
      a.range,
      (e) => e.hero !== undefined && sim.tick - e.hero.lastHeroHitTick <= TOWER.heroAggroTicks,
    );
    if (aggressor) {
      a.targetId = aggressor.id;
      continue;
    }
    const current = a.targetId === null ? undefined : sim.get(a.targetId);
    if (current && sim.isTargetable(current) && sim.inRange(t, current, a.range)) continue;
    const next = sim.nearestEnemy(t, a.range, (e) => e.kind === 'minion') ?? sim.nearestEnemy(t, a.range);
    a.targetId = next?.id ?? null;
  }
}
