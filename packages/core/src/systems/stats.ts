import { HERO } from '../data/balance.js';
import { itemTotals } from '../data/items.js';
import { FOLLOWERS, HEAT, SYNERGY } from '../races/index.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { EvolutionDef, HeroDef } from '../types.js';

const NO_EVOLUTION: EvolutionDef = { level: 0, scale: 1, hp: 0, attack: 0, abilityMult: 1 };

/** The dragon form a hero of this level is in (stage 0 = not evolved). */
export function evolutionOf(def: HeroDef, stage: number): EvolutionDef {
  return stage > 0 ? (def.evolutions?.[stage - 1] ?? NO_EVOLUTION) : NO_EVOLUTION;
}

/**
 * Rebuilds a hero's stats from scratch: base, level, evolution, items, followers and cannon mode.
 * Temporary statuses (haste, armor, attack buffs) are applied where they are used, not here.
 */
export function recomputeStats(sim: Sim, h: HeroEntity): void {
  const hero = h.hero;
  const def = sim.heroDef(hero.defId);
  const levels = hero.level - 1;
  const items = itemTotals(hero.items);

  const synergy = sim.synergy[h.team];
  const paired = synergy.race === def.race;
  const early = paired && def.race === 'dragon' ? SYNERGY.dragonEarlyLevels : 0;
  const stage = (def.evolutions ?? []).filter((e) => hero.level >= e.level - early).length;
  if (stage !== hero.stage) {
    hero.stage = stage;
    sim.emit({ t: 'evolve', id: h.id, stage });
  }
  const evolution = evolutionOf(def, stage);
  const followers = def.race === 'god' ? hero.followers * (paired ? SYNERGY.godFollowerMult : 1) : 0;
  const siege = hero.siege ? def.abilities.W.params : undefined;
  const siegeLevel = Math.max(0, hero.abilityLevels.W - 1);

  const maxHp = Math.round((def.base.hp + def.base.hpPerLevel * levels + evolution.hp) * HERO.toughness + items.hp);
  if (!h.dead && maxHp > h.health.maxHp) h.health.hp += maxHp - h.health.maxHp;
  h.health.maxHp = maxHp;
  h.health.hp = Math.min(h.health.hp, maxHp);
  h.health.armor = def.base.armor + items.armor + followers * FOLLOWERS.armorPerFollower;

  const maxMana = def.resource === 'mana' ? def.base.mana + def.base.manaPerLevel * levels + items.mana : 0;
  if (!h.dead && maxMana > hero.maxMana) hero.mana += maxMana - hero.maxMana;
  hero.maxMana = maxMana;
  hero.mana = Math.min(hero.mana, maxMana);

  const attack = def.base.attack + def.base.attackPerLevel * levels + evolution.attack + items.attack;
  h.attacker.damage = attack * (1 + followers * FOLLOWERS.attackPerFollower + (siege?.attack[siegeLevel] ?? 0));
  h.attacker.range = def.base.attackRange + (siege?.range[siegeLevel] ?? 0);
  h.attacker.intervalTicks = Math.max(4, Math.round(def.base.attackInterval / (1 + items.attackSpeed)));
  h.mover.speed = (def.base.moveSpeed + items.moveSpeed) * (synergy.speed ? 1 + SYNERGY.speed : 1);
  h.radius = HERO.radius * evolution.scale;
}

/** Multiplier on a hero's ability damage right now: items, dragon form and running hot. */
export function abilityPower(sim: Sim, h: HeroEntity): number {
  const def = sim.heroDef(h.hero.defId);
  const hot = def.resource === 'heat' && h.hero.heat > HEAT.bonusThreshold ? HEAT.bonusMult : 1;
  return (1 + itemTotals(h.hero.items).abilityDamage) * evolutionOf(def, h.hero.stage).abilityMult * hot;
}

export function isFlying(sim: Sim, h: HeroEntity): boolean {
  return evolutionOf(sim.heroDef(h.hero.defId), h.hero.stage).flying === true;
}
