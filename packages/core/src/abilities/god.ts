import { seconds } from '../data/balance.js';
import { angleTo } from '../math.js';
import type { UnitEntity } from '../sim/Sim.js';
import type { AbilityEffect } from '../systems/ability.js';
import { spawnZone } from '../systems/summons.js';

const hpRatio = (e: UnitEntity): number => e.health.hp / e.health.maxHp;
/** The most wounded unit of a list; ties go to the lower id so the result is deterministic. */
export function mostWounded(units: UnitEntity[]): UnitEntity | undefined {
  return [...units].sort((a, b) => hpRatio(a) - hpRatio(b) || a.id - b.id)[0];
}

export const godEffects: Record<string, AbilityEffect> = {
  // ---- Sola ----

  /** Heal the most wounded allied hero in range, and the minions around them for less. */
  sola_heal({ sim, caster, def, param }) {
    const heroes = sim.alliesWithin(caster.team, caster.pos, def.range).filter((e) => e.hero);
    const patient = mostWounded(heroes) ?? caster;
    sim.heal(patient, param('heal'));
    for (const e of sim.alliesWithin(caster.team, patient.pos, param('radius'))) {
      if (e.minion) sim.heal(e, param('heal') * param('minionPct'));
    }
  },

  /** Shield every allied hero and minion in range. */
  sola_shield({ sim, caster, def, param }) {
    for (const e of sim.alliesWithin(caster.team, caster.pos, def.range)) {
      if (e.hero || e.minion) sim.addStatus(e, 'shield', param('durationTicks'), param('shield'));
    }
  },

  /** A ray of light that damages and slows. */
  sola_ray({ sim, caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** A big heal and a burst of speed for every ally in a wide area. */
  sola_dawn({ sim, caster, def, param }) {
    for (const e of sim.alliesWithin(caster.team, caster.pos, def.range)) {
      if (!e.hero && !e.minion) continue;
      sim.heal(e, param('heal'));
      sim.addStatus(e, 'haste', param('hasteTicks'), param('haste'));
    }
  },

  // ---- Vesper ----

  /** Appear behind the target and stab; stronger out of stealth. */
  vesper_ambush({ sim, caster, target, param, damage, blink, wasStealthed }) {
    if (!target) return;
    const gap = target.radius + caster.radius + 0.3;
    blink({ x: target.pos.x - Math.sin(target.facing) * gap, z: target.pos.z - Math.cos(target.facing) * gap });
    caster.facing = angleTo(caster.pos, target.pos);
    damage(target, param('damage') * (wasStealthed ? param('stealthMult') : 1));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },

  /** Vanish and move faster. Attacking or casting ends it. */
  vesper_shroud({ sim, caster, param }) {
    sim.addStatus(caster, 'stealth', param('stealthTicks'));
    sim.addStatus(caster, 'haste', param('stealthTicks'), param('haste'));
  },

  /** A thrown dart that damages and slows. */
  vesper_dart({ sim, caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** Darkness over an area: enemy heroes inside can barely see. */
  vesper_darkness({ sim, caster, point, param }) {
    spawnZone(sim, caster, point, {
      effect: 'blind',
      radius: param('radius'),
      lifeTicks: param('lifeTicks'),
      everyTicks: seconds(0.25),
      value: 0,
    });
  },
};
