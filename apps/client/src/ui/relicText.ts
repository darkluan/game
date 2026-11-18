import type { RelicType } from '@game/core';

export const RELIC_NAMES: Record<RelicType, string> = { thunder: 'Sấm', shield: 'Khiên', fury: 'Cuồng nộ' };

export const RELIC_EFFECTS: Record<RelicType, string> = {
  thunder: 'đòn đánh thường giật sét sang 2 kẻ địch gần đó',
  shield: 'lính và trụ phe mình được khiên chắn sát thương',
  fury: 'gây thêm 25% sát thương nhưng nhận thêm 15%',
};
