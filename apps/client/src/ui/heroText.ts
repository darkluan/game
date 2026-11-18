import { tr } from '@/i18n';
import { type ItemStats, type Race, RACES, type Role } from '@game/core';

export const ROLE_NAMES: Record<Role, string> = {
  fighter: tr('Đấu sĩ'),
  marksman: tr('Xạ thủ'),
  mage: tr('Pháp sư'),
  tank: tr('Đỡ đòn'),
  assassin: tr('Sát thủ'),
  support: tr('Hỗ trợ'),
};

export const raceName = (race: Race): string => tr(RACES[race].name);

/** Tailwind text colour class for each race (tokens in index.css). */
export const RACE_TEXT: Record<Race, string> = {
  human: 'text-race-human',
  dragon: 'text-race-dragon',
  god: 'text-race-god',
  machine: 'text-race-machine',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const STAT_TEXT: { [K in keyof ItemStats]-?: (v: number) => string } = {
  attack: (v) => tr('+{v} sát thương', { v: v }),
  attackSpeed: (v) => tr('+{v} tốc đánh', { v: pct(v) }),
  armor: (v) => tr('+{v} giáp', { v: v }),
  hp: (v) => tr('+{v} máu', { v: v }),
  hpRegen: (v) => tr('+{v} hồi máu/giây', { v: v }),
  mana: (v) => tr('+{v} mana', { v: v }),
  manaRegen: (v) => tr('+{v} hồi mana/giây', { v: v }),
  moveSpeed: (v) => tr('+{v} tốc chạy', { v: v }),
  lifesteal: (v) => tr('{v} hút máu', { v: pct(v) }),
  abilityDamage: (v) => tr('+{v} sát thương chiêu', { v: pct(v) }),
  cooldownReduction: (v) => tr('-{v} hồi chiêu', { v: pct(v) }),
};

/** "+12 sát thương, +220 máu" */
export function describeItem(stats: ItemStats): string {
  return (Object.keys(stats) as (keyof ItemStats)[]).map((key) => STAT_TEXT[key](stats[key] ?? 0)).join(', ');
}
