import { seconds } from '../data/balance.js';
import { angleTo } from '../math.js';
import type { AbilityEffect } from '../systems/ability.js';
import { mostWounded } from './god.js';

const TURRET = { radius: 0.6, armor: 10, intervalTicks: seconds(1), projectileSpeed: 18 } as const;

export const machineEffects: Record<string, AbilityEffect> = {
  // ---- Bolt-7 ----

  /** A piercing burst along a line. */
  bolt_burst({ caster, point, param, damage, enemiesOnLine }) {
    for (const e of enemiesOnLine(caster.pos, point, param('width'))) damage(e, param('damage'));
  },

  /** Toggle the fixed cannon form. The stat changes are applied in systems/stats. */
  bolt_siege({ caster }) {
    caster.hero.siege = !caster.hero.siege;
    caster.mover.path = [];
    caster.hero.order = { t: 'idle' };
  },

  /** Dump all Heat as an explosion: the hotter, the bigger. */
  bolt_vent({ sim, caster, param, damage }) {
    const amount = param('damage') + caster.hero.heat * param('perHeat');
    for (const e of sim.enemiesWithin(caster.team, caster.pos, param('radius'))) damage(e, amount);
    caster.hero.heat = 0;
  },

  /** A shell dropped on a far-away point. */
  bolt_orbital({ sim, caster, point, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) damage(e, param('damage'));
  },

  // ---- Mekka ----

  /** Build a small turret. The oldest one is scrapped beyond the limit. */
  mekka_turret({ sim, caster, point, param, power }) {
    const mine = sim.q.turrets.entities
      .filter((t) => t.turret.ownerId === caster.id && !t.dead)
      .sort((a, b) => a.id - b.id);
    if (mine.length >= param('max')) mine[0].dead = true;
    sim.spawn({
      kind: 'turret',
      team: caster.team,
      pos: sim.nav.nearestWalkable(point),
      radius: TURRET.radius,
      health: { hp: param('hp'), maxHp: param('hp'), armor: TURRET.armor },
      statuses: [],
      attacker: {
        damage: param('attack') * power,
        range: param('range'),
        intervalTicks: TURRET.intervalTicks,
        cooldown: 0,
        projectileSpeed: TURRET.projectileSpeed,
        targetId: null,
      },
      turret: { ownerId: caster.id, untilTick: sim.tick + param('lifeTicks') },
    });
  },

  /** Repair the most damaged allied tower or turret in range; with none, patch up an allied hero. */
  mekka_repair({ sim, caster, def, param }) {
    const allies = sim.alliesWithin(caster.team, caster.pos, def.range);
    const machine = mostWounded(allies.filter((e) => (e.tower || e.turret) && e.health.hp < e.health.maxHp));
    if (machine) sim.heal(machine, param('repair'));
    else sim.heal(mostWounded(allies.filter((e) => e.hero)) ?? caster, param('heal'));
  },

  /** A grenade that damages and silences. */
  mekka_emp({ sim, caster, point, param, damage }) {
    for (const e of sim.enemiesWithin(caster.team, point, param('radius'))) {
      damage(e, param('damage'));
      sim.addStatus(e, 'silence', param('silenceTicks'));
    }
  },

  /** Repair and overcharge every allied tower and turret in range. */
  mekka_overdrive({ sim, caster, def, param }) {
    for (const e of sim.alliesWithin(caster.team, caster.pos, def.range)) {
      if (!e.tower && !e.turret) continue;
      sim.heal(e, param('repair'));
      sim.addStatus(e, 'attack', param('buffTicks'), param('attack'));
    }
  },

  // ---- Raze-3 ----

  /** Slide straight through enemies, cutting all of them. */
  raze_saw({ caster, def, param, damage, dash, enemiesOnLine }) {
    const from = dash(def.range);
    for (const e of enemiesOnLine(from, caster.pos, param('width'))) damage(e, param('damage'));
  },

  /** Overpressure: faster, and harder basic attacks, for a few seconds. */
  raze_boost({ sim, caster, param }) {
    sim.addStatus(caster, 'haste', param('buffTicks'), param('haste'));
    sim.addStatus(caster, 'attack', param('buffTicks'), param('attack'));
  },

  /** A thrown blade that damages and marks its target. */
  raze_blade({ sim, target, param, damage }) {
    if (!target) return;
    damage(target, param('damage'));
    sim.addStatus(target, 'mark', param('markTicks'), param('mark'));
  },

  /** Appear behind a target and strike; much harder when it is already low. */
  raze_execute({ sim, caster, target, param, damage, blink }) {
    if (!target) return;
    const gap = target.radius + caster.radius + 0.3;
    blink({ x: target.pos.x - Math.sin(target.facing) * gap, z: target.pos.z - Math.cos(target.facing) * gap });
    caster.facing = angleTo(caster.pos, target.pos);
    const low = target.health.hp / target.health.maxHp < param('threshold');
    damage(target, param('damage') * (low ? param('lowMult') : 1));
    if (sim.isTargetable(target)) caster.hero.order = { t: 'attack', targetId: target.id };
  },
};
