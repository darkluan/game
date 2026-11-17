import { distToSegment } from '../math.js';
import type { AbilityEffect } from '../systems/ability.js';

const DASH_STEP = 0.25;

export const kaelEffects: Record<string, AbilityEffect> = {
  /** Dash in a line; enemies along the way take damage and are slowed. */
  kael_charge({ sim, caster, def, dir, param }) {
    const from = { ...caster.pos };
    for (let travelled = 0; travelled < def.range; travelled += DASH_STEP) {
      const x = caster.pos.x + dir.x * DASH_STEP;
      const z = caster.pos.z + dir.z * DASH_STEP;
      if (!sim.nav.isWalkable(x, z)) break;
      caster.pos.x = x;
      caster.pos.z = z;
    }
    caster.mover.path = [];
    caster.hero.order = { t: 'idle' };
    const half = param('width') / 2;
    for (const e of sim.enemiesWithin(caster.team, from, def.range + half)) {
      if (distToSegment(e.pos, from, caster.pos) > half + e.radius) continue;
      sim.dealDamage(e, param('damage'), caster);
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** Raise a shield that absorbs damage for a few seconds. */
  kael_guard({ sim, caster, param }) {
    sim.addStatus(caster, 'shield', param('durationTicks'), param('shield'));
  },

  /** Shield bash: damage and stun one enemy, then keep attacking it. */
  kael_bash({ sim, caster, target, param }) {
    if (!target) return;
    sim.dealDamage(target, param('damage'), caster);
    sim.addStatus(target, 'stun', param('stunTicks'));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },

  /** Leap to a point; enemies around the landing take damage and are stunned. */
  kael_verdict({ sim, caster, point, param }) {
    const landing = sim.nav.nearestWalkable(point);
    caster.pos.x = landing.x;
    caster.pos.z = landing.z;
    caster.mover.path = [];
    caster.hero.order = { t: 'idle' };
    for (const e of sim.enemiesWithin(caster.team, landing, param('radius'))) {
      sim.dealDamage(e, param('damage'), caster);
      sim.addStatus(e, 'stun', param('stunTicks'));
    }
  },
};
