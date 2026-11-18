import { tr } from '@/i18n';
import type { RelicType } from '@game/core';

export const RELIC_NAMES: Record<RelicType, string> = { thunder: tr('Sấm'), shield: tr('Khiên'), fury: tr('Cuồng nộ') };

export const RELIC_EFFECTS: Record<RelicType, string> = {
  thunder: tr('đòn đánh thường giật sét sang 2 kẻ địch gần đó'),
  shield: tr('lính và trụ phe mình được khiên chắn sát thương'),
  fury: tr('gây thêm 25% sát thương nhưng nhận thêm 15%'),
};
