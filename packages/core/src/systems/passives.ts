import type { Sim } from '../sim/Sim.js';
import type { Entity } from '../types.js';

type DamageTakenHook = (
  victim: Entity,
  source: Entity | null,
  amount: number,
  params: Record<string, number>,
) => number;

/** Hero passives that change incoming damage, keyed by HeroDef.passive.effect. */
const DAMAGE_TAKEN: Record<string, DamageTakenHook> = {
  // Less damage from the arc the hero faces, more from the arc behind.
  frontal_guard(victim, source, amount, p) {
    if (!source) return amount;
    const dx = source.pos.x - victim.pos.x;
    const dz = source.pos.z - victim.pos.z;
    const len = Math.hypot(dx, dz);
    if (len === 0) return amount;
    const cos = (Math.sin(victim.facing) * dx + Math.cos(victim.facing) * dz) / len;
    if (cos >= p.arcCos) return amount * p.frontMult;
    if (cos <= -p.arcCos) return amount * p.backMult;
    return amount;
  },
};

export function modifyDamageTaken(sim: Sim, victim: Entity, source: Entity | null, amount: number): number {
  if (!victim.hero) return amount;
  const passive = sim.heroDef(victim.hero.defId).passive;
  const hook = passive && DAMAGE_TAKEN[passive.effect];
  return hook ? hook(victim, source, amount, passive.params) : amount;
}
