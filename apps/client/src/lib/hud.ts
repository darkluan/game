import {
  ABILITY_SLOTS,
  type HeroDef,
  maxAbilityLevel,
  raceOf,
  type StatusType,
  type Team,
  TICK_RATE,
  type YouSnap,
} from '@game/core';
import type { HeroScore, HudState } from './session';

export interface HudInput {
  tick: number;
  def: HeroDef;
  team: Team;
  hp: number;
  maxHp: number;
  level: number;
  stage: number;
  dead: boolean;
  /** Whether the hero is under each kind of status. */
  has: (type: StatusType) => boolean;
  siege: boolean;
  you: YouSnap;
  scores: HeroScore[];
  winner: Team | null;
}

const CONDITION_LABELS: [StatusType, string][] = [
  ['stun', 'Bị choáng'],
  ['stone', 'Hóa đá'],
  ['silence', 'Câm lặng'],
  ['root', 'Bị trói chân'],
  ['slow', 'Bị chậm'],
  ['blind', 'Bị mù'],
  ['mark', 'Bị đánh dấu'],
  ['burn', 'Bị thiêu đốt'],
  ['stealth', 'Tàng hình'],
  ['haste', 'Tăng tốc'],
];

/** Turns the player's hero state into what the HUD displays. The same for offline and online play. */
export function buildHud(input: HudInput): HudState {
  const { def, you, has } = input;
  const disabled = input.dead || has('stun') || has('stone') || has('silence');
  const conditions = CONDITION_LABELS.filter(([type]) => has(type)).map(([, label]) => label);
  if (input.siege) conditions.push('Chế độ pháo');
  return {
    timeSeconds: Math.floor(input.tick / TICK_RATE),
    heroDefId: def.id,
    heroName: `${def.name}, ${def.title}`,
    race: def.race,
    team: input.team,
    hp: input.hp,
    maxHp: input.maxHp,
    shield: you.shield,
    resource: def.resource,
    mana: you.mana,
    maxMana: you.maxMana,
    heat: you.heat,
    overloadSeconds: Math.ceil(you.overload / TICK_RATE),
    stage: input.stage,
    followers: you.followers,
    level: input.level,
    xpFraction: you.xp,
    gold: you.gold,
    skillPoints: you.skillPoints,
    dead: input.dead,
    respawnSeconds: Math.ceil(you.respawn / TICK_RATE),
    conditions,
    abilities: ABILITY_SLOTS.map((slot, i) => {
      const ability = def.abilities[slot];
      const level = you.levels[i];
      const index = Math.max(0, level - 1);
      const left = you.cooldowns[i];
      const affordable = def.resource !== 'mana' || you.mana >= ability.cost[index];
      return {
        slot,
        name: ability.name,
        description: ability.description,
        level,
        cost: def.resource === 'none' ? 0 : ability.cost[index],
        cooldownLeft: left / TICK_RATE,
        cooldownFraction: left / ability.cooldownTicks[index],
        canLevelUp: you.skillPoints > 0 && level < maxAbilityLevel(ability, slot, input.level),
        usable: level > 0 && left === 0 && !disabled && affordable,
      };
    }),
    items: you.items,
    itemSlots: raceOf(def.race).itemSlots,
    canShop: you.canShop,
    scores: [...input.scores].sort((a, b) => a.team - b.team || a.id - b.id),
    winner: input.winner,
  };
}
