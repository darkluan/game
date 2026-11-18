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

  // ---- Orun ----

  /** A hammer blow that damages and slows hard. */
  orun_hammer({ sim, caster, target, param, damage }) {
    if (!target) return;
    damage(target, param('damage'));
    sim.addStatus(target, 'slow', param('slowTicks'), param('slow'));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },

  /** Armour for himself and every allied hero and minion close by. */
  orun_bulwark({ sim, caster, def, param }) {
    for (const e of sim.alliesWithin(caster.team, caster.pos, def.range)) {
      if (e.hero || e.minion) sim.addStatus(e, 'armor', param('buffTicks'), param('armor'));
    }
  },

  /** Tear the ground along a line and drag the enemies on it toward him. */
  orun_pull({ sim, caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) {
      damage(e, param('damage'));
      // Pushing away from the point mirrored through the enemy moves it toward the caster.
      sim.knockback(e, { x: 2 * e.pos.x - caster.pos.x, z: 2 * e.pos.z - caster.pos.z }, param('pull'));
    }
  },

  /** The ground shakes: damage and a stun for everything around him. */
  orun_quake({ sim, caster, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'stun', param('stunTicks'));
    }
  },

  // ---- Aeris ----

  /** A piercing blade of wind. */
  aeris_gale({ caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) damage(e, param('damage'));
  },

  /** A whirlwind at a point: damage, and everything in it is thrown outward. */
  aeris_cyclone({ sim, caster, point, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) {
      damage(e, param('damage'));
      sim.knockback(e, point, param('knockback'));
    }
  },

  /** Ride the wind: faster, behind a thin shield. */
  aeris_drift({ sim, caster, param }) {
    sim.addStatus(caster, 'haste', param('buffTicks'), param('haste'));
    sim.addStatus(caster, 'shield', param('buffTicks'), param('shield'));
  },

  /** A storm over a wide area: it keeps hurting, and slows whoever it catches as it lands. */
  aeris_tempest({ sim, caster, point, param, power }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius')))
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    spawnZone(sim, caster, point, {
      effect: 'burn',
      radius: param('radius'),
      lifeTicks: param('lifeTicks'),
      everyTicks: seconds(0.5),
      value: (param('burn') * power) / 2,
    });
  },
};
