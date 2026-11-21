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
import { abilityDamageBonus } from './passives.js';
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

/** Where a cast goes, once the rules of its targeting have been applied. */
interface Aim {
  point: Vec2;
  dir: Vec2;
  target: UnitEntity | null;
}

/**
 * Works out where `def` goes when cast by `caster`, or null when it cannot be cast there: a unit
 * that is out of reach, hidden or not an enemy; a point ability given no point.
 */
function aimFor(
  sim: Sim,
  caster: HeroEntity,
  def: AbilityDef,
  at: { targetId?: number; x?: number; z?: number },
): Aim | null {
  let point: Vec2 = { ...caster.pos };
  let dir: Vec2 = { x: Math.sin(caster.facing), z: Math.cos(caster.facing) };
  let target: UnitEntity | null = null;

  if (def.targeting === 'unit') {
    const t = at.targetId === undefined ? undefined : sim.get(at.targetId);
    if (!t || t.team === caster.team || t.kind === 'tower' || t.kind === 'shrine') return null;
    if (!sim.isTargetable(t) || !sim.canSee(caster, t)) return null;
    if (!sim.inRange(caster, t, def.range)) return null;
    target = t;
    point = { ...t.pos };
    const d = dist(caster.pos, t.pos);
    if (d > 1e-6) dir = { x: (t.pos.x - caster.pos.x) / d, z: (t.pos.z - caster.pos.z) / d };
  } else if (def.targeting === 'point' || def.targeting === 'direction') {
    if (at.x === undefined || at.z === undefined) return null;
    const aim = { x: at.x, z: at.z };
    const d = dist(caster.pos, aim);
    if (d > 1e-6) dir = { x: (aim.x - caster.pos.x) / d, z: (aim.z - caster.pos.z) / d };
    const reach = def.targeting === 'direction' ? def.range : Math.min(d, def.range);
    point = { x: caster.pos.x + dir.x * reach, z: caster.pos.z + dir.z * reach };
  }
  return { point, dir, target };
}

/** Runs an ability's handler for `caster` at `level`, aimed as given. */
function perform(
  sim: Sim,
  caster: HeroEntity,
  def: AbilityDef,
  level: number,
  aim: Aim,
  power: number,
  wasStealthed: boolean,
): void {
  const effect = EFFECTS[def.effect];
  if (!effect) throw new Error(`No handler for ability effect: ${def.effect}`);
  const hero = caster.hero;
  const { point, dir, target } = aim;
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
    damage: (victim, amount) =>
      sim.dealDamage(victim, amount * power * abilityDamageBonus(sim, caster, victim), caster),
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
}

/** Abilities that change what their own hero is, which another hero has no way to undo: never copied. */
const UNCOPYABLE: ReadonlySet<AbilityDef['ai']> = new Set(['siege']);

/**
 * Casts for `caster` the ability `victim` cast last, at `level` and aimed at `victim`, free of
 * cost and cooldown: the body of an ability that copies. Returns the ability copied, or null when
 * there was nothing to copy (the victim has cast nothing yet, or only what cannot be copied, or the
 * copy has no way to reach it).
 */
export function recast(
  sim: Sim,
  caster: HeroEntity,
  victim: UnitEntity,
  level: number,
  power: number,
): AbilityDef | null {
  const last = victim.hero?.lastCast;
  if (!last) return null;
  const def = sim.heroDef(last.defId).abilities[last.slot];
  if (UNCOPYABLE.has(def.ai) || def.effect === sim.heroDef(caster.hero.defId).abilities.R.effect) return null;
  // An ability with fewer levels than the copier has in its own is copied at its best.
  const copied = Math.min(level, def.cooldownTicks.length);
  // What reached the victim from where the copier stands may be longer than the copy's own reach:
  // a unit ability is let off that rule, a point or a line falls as near the victim as it can.
  const reachable = def.targeting === 'unit' ? { ...def, range: Infinity } : def;
  const aim = aimFor(sim, caster, reachable, { targetId: victim.id, x: victim.pos.x, z: victim.pos.z });
  if (!aim) return null;
  sim.emit({ t: 'cast', casterId: caster.id, slot: 'R', abilityId: def.id, x: aim.point.x, z: aim.point.z });
  perform(sim, caster, def, copied, aim, power, false);
  return def;
}

export function castAbility(sim: Sim, caster: HeroEntity, cmd: Extract<Command, { t: 'cast' }>): boolean {
  if (castBlocker(sim, caster, cmd.slot) !== null) return false;
  const hero = caster.hero;
  const heroDef = sim.heroDef(hero.defId);
  const def = heroDef.abilities[cmd.slot];
  const level = hero.abilityLevels[cmd.slot];
  const cost = def.cost[level - 1];

  const aim = aimFor(sim, caster, def, cmd);
  if (!aim) return false;
  const { point } = aim;
  if (!EFFECTS[def.effect]) throw new Error(`No handler for ability effect: ${def.effect}`);

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
  // Noted before the handler runs: an ability that copies reads its victim's, never its own.
  hero.lastCast = { defId: hero.defId, slot: cmd.slot };
  sim.emit({ t: 'cast', casterId: caster.id, slot: cmd.slot, abilityId: def.id, x: point.x, z: point.z });

  perform(sim, caster, def, level, aim, power, wasStealthed);

  if (heroDef.resource === 'heat' && hero.heat >= HEAT.max && hero.overloadUntil === 0) {
    hero.overloadUntil = sim.tick + HEAT.overloadTicks;
    sim.addStatus(caster, 'silence', HEAT.overloadTicks);
    sim.addStatus(caster, 'slow', HEAT.overloadTicks, HEAT.overloadSlow);
    sim.emit({ t: 'overload', id: caster.id });
  }
  return true;
}
