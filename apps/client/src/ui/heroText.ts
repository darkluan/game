import { type ItemStats, type Race, RACES, type Role } from '@game/core';

export const ROLE_NAMES: Record<Role, string> = {
  fighter: 'Đấu sĩ',
  marksman: 'Xạ thủ',
  mage: 'Pháp sư',
  tank: 'Đỡ đòn',
  assassin: 'Sát thủ',
  support: 'Hỗ trợ',
};

export const raceName = (race: Race): string => RACES[race].name;

/** Tailwind text colour class for each race (tokens in index.css). */
export const RACE_TEXT: Record<Race, string> = {
  human: 'text-race-human',
  dragon: 'text-race-dragon',
  god: 'text-race-god',
  machine: 'text-race-machine',
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const STAT_TEXT: { [K in keyof ItemStats]-?: (v: number) => string } = {
  attack: (v) => `+${v} sát thương`,
  attackSpeed: (v) => `+${pct(v)} tốc đánh`,
  armor: (v) => `+${v} giáp`,
  hp: (v) => `+${v} máu`,
  hpRegen: (v) => `+${v} hồi máu/giây`,
  mana: (v) => `+${v} mana`,
  manaRegen: (v) => `+${v} hồi mana/giây`,
  moveSpeed: (v) => `+${v} tốc chạy`,
  lifesteal: (v) => `${pct(v)} hút máu`,
  abilityDamage: (v) => `+${pct(v)} sát thương chiêu`,
  cooldownReduction: (v) => `-${pct(v)} hồi chiêu`,
};

/** "+12 sát thương, +220 máu" */
export function describeItem(stats: ItemStats): string {
  return (Object.keys(stats) as (keyof ItemStats)[]).map((key) => STAT_TEXT[key](stats[key] ?? 0)).join(', ');
}
