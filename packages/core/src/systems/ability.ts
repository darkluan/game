import { kaelEffects } from '../abilities/kael.js';
import { ULT_UNLOCK_LEVELS } from '../data/balance.js';
import { angleTo, dist } from '../math.js';
import type { HeroEntity, Sim, UnitEntity } from '../sim/Sim.js';
import type { AbilityDef, AbilitySlot, Command, Vec2 } from '../types.js';

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
  /** Balance number for the ability's current level. */
  param(name: string): number;
}

export type AbilityEffect = (ctx: CastContext) => void;

/** Ability handlers keyed by AbilityDef.effect. A new hero adds its handlers here. */
const EFFECTS: Record<string, AbilityEffect> = { ...kaelEffects };

export function castReadyTick(hero: HeroEntity, slot: AbilitySlot): number {
  return hero.hero.readyAt[slot];
}

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

export function castAbility(sim: Sim, caster: HeroEntity, cmd: Extract<Command, { t: 'cast' }>): boolean {
  const hero = caster.hero;
  const heroDef = sim.heroDef(hero.defId);
  const def = heroDef.abilities[cmd.slot];
  const level = hero.abilityLevels[cmd.slot];
  if (level <= 0 || caster.dead || sim.hasStatus(caster, 'stun') || sim.tick < hero.readyAt[cmd.slot]) return false;
  const cost = def.cost[level - 1];
  if (heroDef.resource === 'mana' && hero.mana < cost) return false;

  let point: Vec2 = { ...caster.pos };
  let dir: Vec2 = { x: Math.sin(caster.facing), z: Math.cos(caster.facing) };
  let target: UnitEntity | null = null;

  if (def.targeting === 'unit') {
    const t = cmd.targetId === undefined ? undefined : sim.get(cmd.targetId);
    if (!t || t.team === caster.team || !sim.isTargetable(t) || !sim.inRange(caster, t, def.range)) return false;
    target = t;
    point = { ...t.pos };
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
  if (heroDef.resource === 'mana') hero.mana -= cost;
  hero.readyAt[cmd.slot] = sim.tick + def.cooldownTicks[level - 1];
  if (def.targeting !== 'self') caster.facing = angleTo(caster.pos, point);
  sim.emit({ t: 'cast', casterId: caster.id, slot: cmd.slot, abilityId: def.id, x: point.x, z: point.z });
  effect({ sim, caster, def, point, dir, target, param: (name) => def.params[name][level - 1] });
  return true;
}
