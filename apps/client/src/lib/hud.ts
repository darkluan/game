import { abilityDetails } from './abilityDetails';
import { tr } from '@/i18n';
import {
  ABILITY_SLOTS,
  itemPrice,
  ITEMS,
  RECALL,
  type HeroDef,
  type HeroStats,
  maxAbilityLevel,
  type Race,
  raceOf,
  recommendedBuild,
  SPELL_IDS,
  type SpellId,
  SPELLS,
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

/** How each helper spell is shown: its key on a keyboard, its name and what it does. */
const SPELL_TEXT: Record<SpellId | 'recall', { key: string; name: string; description: string }> = {
  heal: {
    key: 'D',
    name: tr('Hồi máu'),
    description: tr('Hồi ngay {percent}% máu tối đa của tướng.', {
      percent: Math.round(SPELLS.heal.healFraction * 100),
    }),
  },
  flash: {
    key: 'F',
    name: tr('Tốc biến'),
    description: tr('Dịch chuyển tức thời một đoạn ngắn theo hướng nhắm, qua được cả tường.'),
  },
  recall: {
    key: 'T',
    name: tr('Biến về'),
    description: tr('Đứng yên {seconds} giây để về hồ. Di chuyển, tấn công hoặc bị đánh sẽ hủy.', {
      seconds: RECALL.channelTicks / TICK_RATE,
    }),
  },
};

const CONDITION_LABELS: [StatusType, string][] = [
  ['stun', tr('Bị choáng')],
  ['stone', tr('Hóa đá')],
  ['silence', tr('Câm lặng')],
  ['root', tr('Bị trói chân')],
  ['slow', tr('Bị chậm')],
  ['blind', tr('Bị mù')],
  ['mark', tr('Bị đánh dấu')],
  ['burn', tr('Bị thiêu đốt')],
  ['stealth', tr('Tàng hình')],
  ['haste', tr('Tăng tốc')],
];

/** What a team earns from two heroes of one race. */
export const PAIR_TEXT: Record<Race, string> = {
  human: tr('Hai Người: mua đồ rẻ hơn 20%'),
  dragon: tr('Hai Rồng: tiến hóa sớm hơn 1 cấp'),
  god: tr('Hai Thần: mỗi tín đồ mạnh gấp rưỡi'),
  machine: tr('Hai Người máy: Nhiệt giảm nhanh gấp rưỡi'),
};

function synergyLines(synergy: TeamSynergy): string[] {
  const lines = synergy.speed ? [tr('Ba tộc khác nhau: cả đội chạy nhanh hơn 6%')] : [];
  return synergy.race ? [...lines, PAIR_TEXT[synergy.race]] : lines;
}

/** Turns the player's hero state into what the HUD displays. The same for offline and online play. */
export function buildHud(input: HudInput): HudState {
  const { def, you, has } = input;
  // An older server does not send these yet.
  const recallLeft = (you.recall as number | undefined) ?? 0;
  const stuck = input.dead || has('stun') || has('stone');
  const itemSlots = raceOf(def.race).itemSlots;
  const build = recommendedBuild(def.id, def.role);
  const nextItem = you.items.length < itemSlots ? build.find((id) => !you.items.includes(id)) : undefined;
  const nextPrice = nextItem ? itemPrice(nextItem, you.discount) : 0;
  const disabled = input.dead || has('stun') || has('stone') || has('silence');
  const conditions = CONDITION_LABELS.filter(([type]) => has(type)).map(([, label]) => label);
  if (input.siege) conditions.push(tr('Chế độ pháo'));
  return {
    timeSeconds: Math.floor(input.tick / TICK_RATE),
    heroDefId: def.id,
    heroName: `${def.name}, ${tr(def.title)}`,
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
    stages: def.evolutions?.length ?? 0,
    nextEvolveLevel: def.evolutions?.[input.stage]?.level ?? null,
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
        id: ability.id,
        slot,
        name: tr(ability.name),
        description: tr(ability.description),
        level,
        cost: def.resource === 'none' ? 0 : ability.cost[index],
        cooldownLeft: left / TICK_RATE,
        cooldownFraction: left / ability.cooldownTicks[index],
        canLevelUp: you.skillPoints > 0 && level < maxAbilityLevel(ability, slot, input.level),
        usable: level > 0 && left === 0 && !disabled && affordable,
        cooldowns: ability.cooldownTicks.map((ticks) => ticks / TICK_RATE),
        costs: def.resource === 'none' ? [] : ability.cost,
        range: ability.range,
        details: abilityDetails(ability),
      };
    }),
    spells: [
      ...SPELL_IDS.map((id, i) => {
        // An older server does not send the cooldowns yet: show the spell as ready.
        const left = (you.spells as number[] | undefined)?.[i] ?? 0;
        return {
          id,
          ...SPELL_TEXT[id],
          cooldownLeft: left / TICK_RATE,
          cooldownFraction: left / SPELLS[id].cooldownTicks,
          // Silence does not stop a helper spell; only death, a stun or being turned to stone does.
          usable: left === 0 && !stuck,
          cooldown: SPELLS[id].cooldownTicks / TICK_RATE,
        };
      }),
      // Recall has no cooldown: it is ready whenever the hero can act, is away from home and is not already channelling.
      {
        id: 'recall' as const,
        ...SPELL_TEXT.recall,
        cooldownLeft: 0,
        cooldownFraction: 0,
        usable: !stuck && !you.canShop && recallLeft === 0,
        cooldown: 0,
      },
    ],
    recall:
      recallLeft > 0
        ? { seconds: Math.ceil(recallLeft / TICK_RATE), fraction: 1 - recallLeft / RECALL.channelTicks }
        : null,
    recommended: [...build],
    suggestion: nextItem
      ? { id: nextItem, name: tr(ITEMS[nextItem].name), price: nextPrice, affordable: you.gold >= nextPrice }
      : null,
    // An older server does not send these yet.
    stats: (you.stats as HeroStats | undefined) ?? null,
    items: you.items,
    itemSlots,
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
