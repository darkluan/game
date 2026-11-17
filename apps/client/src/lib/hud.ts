import { ABILITY_SLOTS, type HeroDef, maxAbilityLevel, type Team, TICK_RATE, type YouSnap } from '@game/core';
import type { HeroScore, HudState } from './session';

export interface HudInput {
  tick: number;
  def: HeroDef;
  team: Team;
  hp: number;
  maxHp: number;
  level: number;
  dead: boolean;
  stunned: boolean;
  you: YouSnap;
  scores: HeroScore[];
  winner: Team | null;
}

/** Turns the player's hero state into what the HUD displays. The same for offline and online play. */
export function buildHud(input: HudInput): HudState {
  const { def, you } = input;
  return {
    timeSeconds: Math.floor(input.tick / TICK_RATE),
    heroName: def.name,
    team: input.team,
    hp: input.hp,
    maxHp: input.maxHp,
    shield: you.shield,
    mana: you.mana,
    maxMana: you.maxMana,
    level: input.level,
    xpFraction: you.xp,
    gold: you.gold,
    skillPoints: you.skillPoints,
    dead: input.dead,
    respawnSeconds: Math.ceil(you.respawn / TICK_RATE),
    stunned: input.stunned,
    abilities: ABILITY_SLOTS.map((slot, i) => {
      const ability = def.abilities[slot];
      const level = you.levels[i];
      const index = Math.max(0, level - 1);
      const left = you.cooldowns[i];
      return {
        slot,
        name: ability.name,
        level,
        cost: ability.cost[index],
        cooldownLeft: left / TICK_RATE,
        cooldownFraction: left / ability.cooldownTicks[index],
        canLevelUp: you.skillPoints > 0 && level < maxAbilityLevel(ability, slot, input.level),
        usable: level > 0 && left === 0 && !input.dead && !input.stunned && you.mana >= ability.cost[index],
      };
    }),
    scores: [...input.scores].sort((a, b) => a.team - b.team || a.id - b.id),
    winner: input.winner,
  };
}
