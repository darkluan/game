import { seconds } from '../data/balance.js';
import type { AbilityEffect } from '../systems/ability.js';
import { spawnZone } from '../systems/summons.js';

const MAX_TRAPS = 3;
/** Mira's starfall hits twice a second. */
const STARFALL_PULSE_TICKS = seconds(0.5);

export const humanEffects: Record<string, AbilityEffect> = {
  // ---- Kael ----

  /** Dash in a line; enemies along the way take damage and are slowed. */
  kael_charge({ sim, caster, def, param, damage, dash, enemiesOnLine }) {
    const from = dash(def.range);
    for (const e of enemiesOnLine(from, caster.pos, param('width'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** Raise a shield that absorbs damage for a few seconds. */
  kael_guard({ sim, caster, param }) {
    sim.addStatus(caster, 'shield', param('durationTicks'), param('shield'));
  },

  /** Shield bash: damage and stun one enemy, then keep attacking it. */
  kael_bash({ sim, caster, target, param, damage }) {
    if (!target) return;
    damage(target, param('damage'));
    sim.addStatus(target, 'stun', param('stunTicks'));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },

  /** Leap to a point; enemies around the landing take damage and are stunned. */
  kael_verdict({ sim, caster, point, param, damage, blink }) {
    blink(point);
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'stun', param('stunTicks'));
    }
  },

  // ---- Lyra ----

  /** Place a hidden trap. The oldest one is removed beyond the limit. */
  lyra_trap({ sim, caster, point, param, power }) {
    const mine = sim.q.traps.entities
      .filter((t) => t.trap.ownerId === caster.id && !t.dead)
      .sort((a, b) => a.id - b.id);
    if (mine.length >= MAX_TRAPS) mine[0].dead = true;
    sim.spawn({
      kind: 'trap',
      team: caster.team,
      pos: sim.nav.nearestWalkable(point),
      radius: 0.6,
      trap: {
        ownerId: caster.id,
        untilTick: sim.tick + param('lifeTicks'),
        damage: param('damage') * power,
        rootTicks: param('rootTicks'),
        markTicks: param('markTicks'),
        mark: param('mark'),
      },
    });
  },

  /** Mark a target: it takes more damage and cannot hide. */
  lyra_mark({ sim, target, param }) {
    if (target) sim.addStatus(target, 'mark', param('markTicks'), param('mark'));
  },

  /** Short roll, then a burst of speed. */
  lyra_tumble({ sim, caster, def, param, dash }) {
    dash(def.range);
    sim.addStatus(caster, 'haste', param('hasteTicks'), param('haste'));
  },

  /** A very long piercing shot, stronger against marked targets. */
  lyra_final_shot({ sim, caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) {
      damage(e, param('damage') * (sim.hasStatus(e, 'mark') ? param('markedMult') : 1));
    }
  },

  // ---- Mira ----

  /** A piercing bolt of starlight. */
  mira_bolt({ caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) damage(e, param('damage'));
  },

  /** Root every enemy in a small area. */
  mira_bind({ sim, caster, point, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'root', param('rootTicks'));
    }
  },

  /** A short teleport. */
  mira_blink({ point, blink }) {
    blink(point);
  },

  /** Stars keep falling on a wide area. */
  mira_starfall({ sim, caster, point, param, power }) {
    spawnZone(sim, caster, point, {
      effect: 'burn',
      radius: param('radius'),
      lifeTicks: param('lifeTicks'),
      everyTicks: STARFALL_PULSE_TICKS,
      value: (param('burn') * power) / 2,
    });
  },
};
