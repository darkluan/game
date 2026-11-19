import { TOWER } from '../data/balance.js';
import type { Sim, TowerEntity } from '../sim/Sim.js';

/**
 * Sets how hard the tower's next shot lands: the plain rate, or more for every shot it has already
 * had at the hero it is on now.
 */
function focus(sim: Sim, t: TowerEntity): void {
  const a = t.attacker;
  const target = a.targetId === null ? undefined : sim.get(a.targetId);
  if (!target?.hero) {
    t.tower.focusId = undefined;
    a.damage = TOWER.attack;
    return;
  }
  if (t.tower.focusId !== target.id) {
    t.tower.focusId = target.id;
    t.tower.focusSince = sim.tick;
  }
  const shots = Math.min(
    TOWER.focusShots,
    Math.floor((sim.tick - (t.tower.focusSince ?? sim.tick)) / TOWER.intervalTicks),
  );
  a.damage = TOWER.attack * (1 + shots * TOWER.focusStep);
}

/**
 * Towers shoot minions first. A hero that hits an allied hero inside the tower's range
 * becomes the target right away. The longer a tower keeps shooting at one hero, the harder it hits.
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
      focus(sim, t);
      continue;
    }
    const current = a.targetId === null ? undefined : sim.get(a.targetId);
    if (!(current && sim.isTargetable(current) && sim.canSee(t, current) && sim.inRange(t, current, a.range))) {
      const next = sim.nearestEnemy(t, a.range, (e) => e.kind === 'minion') ?? sim.nearestEnemy(t, a.range);
      a.targetId = next?.id ?? null;
    }
    focus(sim, t);
  }
}
