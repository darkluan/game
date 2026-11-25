import { type AbilityDef, type AbilitySlot, type HeroDef, TICK_RATE } from '@game/core';
import type { AbilityHud } from './session';
import { tr } from '@/i18n';

/** How a balance number reads to a player. */
type Unit =
  /** As it is. */
  | 'number'
  /** A fraction shown as a percentage. */
  | 'percent'
  /** Game ticks shown as seconds. */
  | 'seconds'
  /** A multiplier, shown as "×1.5". */
  | 'times'
  /** A fraction when small, a plain number otherwise: some abilities add 30%, others add 36. */
  | 'either';

/** What each ability parameter is called and how its value is shown. One not listed here is not shown. */
const PARAMS: Record<string, [label: string, unit: Unit]> = {
  damage: ['Sát thương', 'number'],
  burn: ['Sát thương cháy mỗi giây', 'number'],
  perHeat: ['Sát thương thêm mỗi điểm Nhiệt', 'number'],
  heal: ['Hồi máu', 'either'],
  minionPct: ['Phần hồi cho lính', 'percent'],
  shield: ['Khiên', 'number'],
  repair: ['Sửa chữa', 'number'],
  armor: ['Giáp cộng thêm', 'number'],
  attack: ['Sát thương đòn đánh', 'either'],
  reduce: ['Giảm sát thương nhận vào', 'percent'],
  mark: ['Sát thương nhận thêm khi bị đánh dấu', 'percent'],
  echo: ['Sức tia khi chép được chiêu', 'percent'],
  markedMult: ['Lên mục tiêu bị đánh dấu', 'times'],
  farMult: ['Ở cuối tầm bắn', 'times'],
  stealthMult: ['Khi đang tàng hình', 'times'],
  lowMult: ['Lên mục tiêu máu thấp', 'times'],
  threshold: ['Ngưỡng máu thấp', 'percent'],
  slow: ['Làm chậm', 'percent'],
  haste: ['Tăng tốc chạy', 'percent'],
  knockback: ['Hất lùi', 'number'],
  pull: ['Kéo lại', 'number'],
  throw: ['Quật ra sau lưng', 'number'],
  stunTicks: ['Choáng', 'seconds'],
  rootTicks: ['Trói chân', 'seconds'],
  silenceTicks: ['Câm lặng', 'seconds'],
  slowTicks: ['Thời gian làm chậm', 'seconds'],
  markTicks: ['Thời gian đánh dấu', 'seconds'],
  burnTicks: ['Thời gian cháy', 'seconds'],
  hasteTicks: ['Thời gian tăng tốc', 'seconds'],
  stoneTicks: ['Thời gian hóa đá', 'seconds'],
  stealthTicks: ['Thời gian tàng hình', 'seconds'],
  buffTicks: ['Thời gian hiệu lực', 'seconds'],
  durationTicks: ['Thời gian hiệu lực', 'seconds'],
  lifeTicks: ['Tồn tại', 'seconds'],
  radius: ['Bán kính', 'number'],
  width: ['Bề rộng', 'number'],
  range: ['Tầm đánh thêm', 'number'],
  hp: ['Máu của tháp', 'number'],
  max: ['Số lượng tối đa', 'number'],
};

const trim = (value: number): string => String(Math.round(value * 100) / 100);

function show(value: number, unit: Unit): string {
  switch (unit) {
    case 'percent':
      return `${trim(value * 100)}%`;
    case 'seconds':
      return tr('{v} giây', { v: trim(value / TICK_RATE) });
    case 'times':
      return `×${trim(value)}`;
    case 'either':
      return value < 5 ? `+${trim(value * 100)}%` : trim(value);
    default:
      return trim(value);
  }
}

/** An ability's numbers as rows of text, one value per ability level, in the order they matter. */
export function abilityDetails(ability: AbilityDef): { label: string; values: string[] }[] {
  return Object.entries(PARAMS).flatMap(([key, [label, unit]]) => {
    const values = ability.params[key];
    return values ? [{ label: tr(label), values: values.map((v) => show(v, unit)) }] : [];
  });
}

/** An ability as the hero picker shows it: everything about it, with no match and so no level or cooldown running. */
export function abilityPreview(hero: HeroDef, slot: AbilitySlot): AbilityHud {
  const ability = hero.abilities[slot];
  return {
    id: ability.id,
    slot,
    name: tr(ability.name),
    description: tr(ability.description),
    level: 0,
    cost: 0,
    cooldownLeft: 0,
    cooldownFraction: 0,
    canLevelUp: false,
    usable: false,
    cooldowns: ability.cooldownTicks.map((ticks) => ticks / TICK_RATE),
    costs: hero.resource === 'none' ? [] : ability.cost,
    range: ability.range,
    details: abilityDetails(ability),
  };
}
