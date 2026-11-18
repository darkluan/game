import {
  ABILITY_SLOTS,
  type HeroDef,
  maxAbilityLevel,
  type Race,
  raceOf,
  type StatusType,
  type Team,
  type TeamSynergy,
  TICK_RATE,
  type YouSnap,
} from '@game/core';
import type { Announcement, HeroScore, HudState, WorldView } from './session';

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
  world: WorldView;
  announcements: Announcement[];
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

const PAIR_TEXT: Record<Race, string> = {
  human: 'Hai Người: mua đồ rẻ hơn 20%',
  dragon: 'Hai Rồng: tiến hóa sớm hơn 1 cấp',
  god: 'Hai Thần: mỗi tín đồ mạnh gấp rưỡi',
  machine: 'Hai Người máy: Nhiệt giảm nhanh gấp rưỡi',
};

function synergyLines(synergy: TeamSynergy): string[] {
  const lines = synergy.speed ? ['Ba tộc khác nhau: cả đội chạy nhanh hơn 6%'] : [];
  return synergy.race ? [...lines, PAIR_TEXT[synergy.race]] : lines;
}

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
    discount: you.discount,
    synergy: synergyLines(you.synergy),
    relic: input.world.relic && {
      type: input.world.relic.type,
      capturing: input.world.relic.team === null ? null : input.world.relic.team === input.team ? 'mine' : 'enemy',
      progress: input.world.relic.progress,
    },
    buffs: [input.team, input.team === 0 ? 1 : 0].flatMap((team) => {
      const buff = input.world.buffs[team];
      return buff ? [{ type: buff.relic, mine: team === input.team, seconds: Math.ceil(buff.left / TICK_RATE) }] : [];
    }),
    announcements: input.announcements,
    scores: [...input.scores].sort((a, b) => a.team - b.team || a.id - b.id),
    winner: input.winner,
  };
}
