import { seconds } from '../data/balance.js';
import type { AbilityEffect } from '../systems/ability.js';
import { spawnZone } from '../systems/summons.js';

/** Fire on the ground hurts twice a second. */
const BURN_PULSE_TICKS = seconds(0.5);
const FLAME_PATCHES = 3;

export const dragonEffects: Record<string, AbilityEffect> = {
  // ---- Ignar ----

  /** Breathe fire along a line and leave patches of flame behind. */
  ignar_breath({ sim, caster, point, param, damage, enemiesOnLine, power }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) damage(e, param('damage'));
    for (let i = 1; i <= FLAME_PATCHES; i++) {
      const t = i / FLAME_PATCHES;
      spawnZone(
        sim,
        caster,
        { x: caster.pos.x + (point.x - caster.pos.x) * t, z: caster.pos.z + (point.z - caster.pos.z) * t },
        {
          effect: 'burn',
          radius: param('radius'),
          lifeTicks: param('burnTicks'),
          everyTicks: BURN_PULSE_TICKS,
          value: (param('burn') * power) / 2,
        },
      );
    }
  },

  /** A fireball that explodes at a point and sets enemies alight. */
  ignar_fireball({ sim, caster, point, param, damage, power }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'burn', param('burnTicks'), param('burn') * power, caster.id);
    }
  },

  /** Beat wings: throw nearby enemies back and slow them. */
  ignar_gust({ sim, caster, param }) {
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      sim.knockback(e, caster.pos, param('knockback'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** A large area that keeps burning. */
  ignar_firestorm({ sim, caster, point, param, power }) {
    spawnZone(sim, caster, point, {
      effect: 'burn',
      radius: param('radius'),
      lifeTicks: param('lifeTicks'),
      everyTicks: BURN_PULSE_TICKS,
      value: (param('burn') * power) / 2,
    });
  },

  // ---- Baru ----

  /** Charge and shove everything in the way. */
  baru_ram({ sim, caster, def, param, damage, dash, enemiesOnLine }) {
    const from = dash(def.range);
    for (const e of enemiesOnLine(from, caster.pos, param('width'))) {
      damage(e, param('damage'));
      sim.knockback(e, from, param('knockback'));
    }
  },

  /** Turn to stone: nearly immune, immobile, and a wall enemies cannot walk through. */
  baru_petrify({ sim, caster, param }) {
    sim.addStatus(caster, 'stone', param('stoneTicks'), param('reduce'));
    sim.heal(caster, caster.health.maxHp * param('heal'));
    caster.mover.path = [];
    caster.hero.order = { t: 'idle' };
  },

  /** Stomp: damage and slow all around. */
  baru_stomp({ sim, caster, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
    }
  },

  /** Leap to a point: heavy damage, stun, and enemies are thrown outward. */
  baru_avalanche({ sim, caster, point, param, damage, blink }) {
    blink(point);
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'stun', param('stunTicks'));
      sim.knockback(e, caster.pos, param('knockback'));
    }
  },

  // ---- Zerak ----

  /** A short lunge that claws everything in its path. */
  zerak_claw({ caster, def, param, damage, dash, enemiesOnLine }) {
    const from = dash(def.range);
    for (const e of enemiesOnLine(from, caster.pos, param('width'))) damage(e, param('damage'));
  },

  /** Charged scales: stronger basic attacks and more speed for a while. */
  zerak_charge({ sim, caster, param }) {
    sim.addStatus(caster, 'attack', param('buffTicks'), param('attack'));
    sim.addStatus(caster, 'haste', param('buffTicks'), param('haste'));
  },

  /** A roar that hurts and silences everything nearby. */
  zerak_roar({ sim, caster, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'silence', param('silenceTicks'));
    }
  },

  /** Dive onto one enemy: heavy damage and a stun, then keep attacking it. */
  zerak_strike({ sim, caster, target, dir, param, damage, blink }) {
    if (!target) return;
    const gap = target.radius + caster.radius + 0.2;
    blink({ x: target.pos.x - dir.x * gap, z: target.pos.z - dir.z * gap });
    damage(target, param('damage'));
    sim.addStatus(target, 'stun', param('stunTicks'));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },

  // ---- Nyx ----

  /** Venom spat along a line: damage now and poison after. */
  nyx_spit({ sim, caster, point, param, damage, enemiesOnLine, power }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'burn', param('burnTicks'), param('burn') * power, caster.id);
    }
  },

  /** A pool of acid that eats at whoever stands in it. */
  nyx_pool({ sim, caster, point, param, power }) {
    spawnZone(sim, caster, point, {
      effect: 'burn',
      radius: param('radius'),
      lifeTicks: param('lifeTicks'),
      everyTicks: BURN_PULSE_TICKS,
      value: (param('burn') * power) / 2,
    });
  },

  /** A quick glide, then a burst of speed. */
  nyx_glide({ sim, caster, def, param, dash }) {
    dash(def.range);
    sim.addStatus(caster, 'haste', param('hasteTicks'), param('haste'));
  },

  /** Plague over an area: heavy damage, and everything in it is slowed and marked. */
  nyx_plague({ sim, caster, point, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'slow', param('slowTicks'), param('slow'));
      sim.addStatus(e, 'mark', param('markTicks'), param('mark'));
    }
  },
};
