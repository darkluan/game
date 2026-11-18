import { dragonEffects } from '../abilities/dragon.js';
import { godEffects } from '../abilities/god.js';
import { humanEffects } from '../abilities/human.js';
import { machineEffects } from '../abilities/machine.js';
import { HERO, ULT_UNLOCK_LEVELS } from '../data/balance.js';
import { itemTotals } from '../data/items.js';
import { angleTo, dist, distToSegment } from '../math.js';
import { HEAT } from '../races/index.js';
import type { HeroEntity, Sim, UnitEntity } from '../sim/Sim.js';
import type { AbilityDef, AbilitySlot, Command, Vec2 } from '../types.js';
import { abilityPower } from './stats.js';

const DASH_STEP = 0.25;

export interface CastContext {
  sim: Sim;
  caster: HeroEntity;
  def: AbilityDef;
  /** Target point, clamped to range. The caster's position for self casts. */
  point: Vec2;
  /** Unit vector from the caster toward the aim point. */
  dir: Vec2;
  /** Set for unit-targeted abilities. */
  target: UnitEntity | null;
  /** The caster was stealthed when the cast began (casting reveals it). */
  wasStealthed: boolean;
  /** Multiplier this cast applies to ability damage; for effects that deal damage later (zones, burns). */
  power: number;
  /** Balance number for the ability's current level. */
  param(name: string): number;
  /** Deal ability damage, scaled by items, dragon form and Heat. */
  damage(target: UnitEntity, amount: number): number;
  /** Enemies touching the segment from `from` to `to`, `width` wide. */
  enemiesOnLine(from: Vec2, to: Vec2, width: number): UnitEntity[];
  /** Move the caster along `dir` until `distance` or a wall. Returns where it started. */
  dash(distance: number): Vec2;
  /** Put the caster on the walkable point nearest `to`. */
  blink(to: Vec2): void;
}

export type AbilityEffect = (ctx: CastContext) => void;

/** Ability handlers keyed by AbilityDef.effect. A new hero adds its handlers to its race's file. */
const EFFECTS: Record<string, AbilityEffect> = { ...humanEffects, ...dragonEffects, ...godEffects, ...machineEffects };

/** How many points the hero may have in `slot` at its current level. */
export function maxAbilityLevel(def: AbilityDef, slot: AbilitySlot, heroLevel: number): number {
  if (slot !== 'R') return def.cooldownTicks.length;
  return Math.min(def.cooldownTicks.length, ULT_UNLOCK_LEVELS.filter((l) => heroLevel >= l).length);
}

export function levelUpAbility(sim: Sim, caster: HeroEntity, slot: AbilitySlot): boolean {
  const hero = caster.hero;
  const def = sim.heroDef(hero.defId).abilities[slot];
  if (hero.skillPoints <= 0 || hero.abilityLevels[slot] >= maxAbilityLevel(def, slot, hero.level)) return false;
  hero.skillPoints--;
  hero.abilityLevels[slot]++;
  return true;
}

/** Why a hero cannot cast `slot` right now, or null when it can (targeting aside). */
export function castBlocker(sim: Sim, caster: HeroEntity, slot: AbilitySlot): string | null {
  const hero = caster.hero;
  const heroDef = sim.heroDef(hero.defId);
  const level = hero.abilityLevels[slot];
  if (level <= 0) return 'not_learned';
  if (caster.dead) return 'dead';
  if (sim.cannotAct(caster) || sim.hasStatus(caster, 'silence')) return 'disabled';
  if (sim.tick < hero.readyAt[slot]) return 'cooldown';
  if (heroDef.resource === 'mana' && hero.mana < heroDef.abilities[slot].cost[level - 1]) return 'no_mana';
  return null;
}

export function castAbility(sim: Sim, caster: HeroEntity, cmd: Extract<Command, { t: 'cast' }>): boolean {
  if (castBlocker(sim, caster, cmd.slot) !== null) return false;
  const hero = caster.hero;
  const heroDef = sim.heroDef(hero.defId);
  const def = heroDef.abilities[cmd.slot];
  const level = hero.abilityLevels[cmd.slot];
  const cost = def.cost[level - 1];

  let point: Vec2 = { ...caster.pos };
  let dir: Vec2 = { x: Math.sin(caster.facing), z: Math.cos(caster.facing) };
  let target: UnitEntity | null = null;

  if (def.targeting === 'unit') {
    const t = cmd.targetId === undefined ? undefined : sim.get(cmd.targetId);
    if (!t || t.team === caster.team || t.kind === 'tower' || t.kind === 'shrine') return false;
    if (!sim.isTargetable(t) || !sim.canSee(caster, t)) return false;
    if (!sim.inRange(caster, t, def.range)) return false;
    target = t;
    point = { ...t.pos };
    const d = dist(caster.pos, t.pos);
    if (d > 1e-6) dir = { x: (t.pos.x - caster.pos.x) / d, z: (t.pos.z - caster.pos.z) / d };
  } else if (def.targeting === 'point' || def.targeting === 'direction') {
    if (cmd.x === undefined || cmd.z === undefined) return false;
    const aim = { x: cmd.x, z: cmd.z };
    const d = dist(caster.pos, aim);
    if (d > 1e-6) dir = { x: (aim.x - caster.pos.x) / d, z: (aim.z - caster.pos.z) / d };
    const reach = def.targeting === 'direction' ? def.range : Math.min(d, def.range);
    point = { x: caster.pos.x + dir.x * reach, z: caster.pos.z + dir.z * reach };
  }

  const effect = EFFECTS[def.effect];
  if (!effect) throw new Error(`No handler for ability effect: ${def.effect}`);

  // Power is read before Heat rises, so the bonus rewards already running hot.
  const power = abilityPower(sim, caster);
  const wasStealthed = sim.hasStatus(caster, 'stealth');
  sim.removeStatus(caster, 'stealth');
  if (heroDef.resource === 'mana') hero.mana -= cost;
  if (heroDef.resource === 'heat') {
    hero.heat = Math.min(HEAT.max, hero.heat + cost);
    hero.lastCastTick = sim.tick;
  }
  const reduction = Math.min(HERO.maxCooldownReduction, itemTotals(hero.items).cooldownReduction);
  hero.readyAt[cmd.slot] = sim.tick + Math.round(def.cooldownTicks[level - 1] * (1 - reduction));
  if (def.targeting !== 'self') caster.facing = angleTo(caster.pos, point);
  sim.emit({ t: 'cast', casterId: caster.id, slot: cmd.slot, abilityId: def.id, x: point.x, z: point.z });

  effect({
    sim,
    caster,
    def,
    point,
    dir,
    target,
    wasStealthed,
    power,
    param: (name) => def.params[name][level - 1],
    damage: (victim, amount) => sim.dealDamage(victim, amount * power, caster),
    enemiesOnLine: (from, to, width) =>
      sim
        .enemiesWithin(caster.team, { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }, dist(from, to) / 2 + width)
        .filter((e) => distToSegment(e.pos, from, to) <= width / 2 + e.radius),
    dash: (distance) => {
      const from = { ...caster.pos };
      for (let travelled = 0; travelled < distance; travelled += DASH_STEP) {
        const x = caster.pos.x + dir.x * DASH_STEP;
        const z = caster.pos.z + dir.z * DASH_STEP;
        if (!sim.nav.isWalkable(x, z)) break;
        caster.pos.x = x;
        caster.pos.z = z;
      }
      caster.mover.path = [];
      hero.order = { t: 'idle' };
      return from;
    },
    blink: (to) => {
      const landing = sim.nav.nearestWalkable(to);
      caster.pos.x = landing.x;
      caster.pos.z = landing.z;
      caster.mover.path = [];
      hero.order = { t: 'idle' };
    },
  });

  if (heroDef.resource === 'heat' && hero.heat >= HEAT.max && hero.overloadUntil === 0) {
    hero.overloadUntil = sim.tick + HEAT.overloadTicks;
    sim.addStatus(caster, 'silence', HEAT.overloadTicks);
    sim.addStatus(caster, 'slow', HEAT.overloadTicks, HEAT.overloadSlow);
    sim.emit({ t: 'overload', id: caster.id });
  }
  return true;
}
