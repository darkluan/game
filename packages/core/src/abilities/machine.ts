import { seconds } from '../data/balance.js';
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
};
