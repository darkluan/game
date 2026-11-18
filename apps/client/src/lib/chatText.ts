import { tr } from '@/i18n';
import type { LobbyChatId, MatchChatId, PingType } from '@game/core';
import type { FxColor } from './session';

/** The ready-made team phrases of a match, in the reader's language. */
export const MATCH_CHAT_TEXT: Record<MatchChatId, string> = {
  attack: tr('Lên đánh!'),
  retreat: tr('Lùi về!'),
  help: tr('Cần giúp!'),
  recalling: tr('Tôi đang về hồ'),
  relic: tr('Lấy di vật'),
  thanks: tr('Cảm ơn'),
  wellPlayed: tr('Làm tốt lắm'),
  sorry: tr('Xin lỗi'),
};

/** What each map signal says, how it is coloured and which icon stands for it. */
export const PING_TEXT: Record<PingType, string> = {
  attack: tr('Tấn công chỗ này!'),
  retreat: tr('Rút lui!'),
  gather: tr('Tập hợp ở đây!'),
};
export const PING_COLOR: Record<PingType, FxColor> = { attack: 'enemy', retreat: 'gold', gather: 'ally' };
export const PING_ICON: Record<PingType, string> = { attack: 'attack', retreat: 'ping_retreat', gather: 'ping_gather' };

/** Phrases that are about a place: receivers also get that signal on the map where the sender stands. */
export const CHAT_SIGNAL: Partial<Record<MatchChatId, PingType>> = {
  attack: 'attack',
  retreat: 'retreat',
  help: 'gather',
};

/** The ready-made phrases of the pick room. */
export const LOBBY_CHAT_TEXT: Record<LobbyChatId, string> = {
  hello: tr('Xin chào'),
  readyUp: tr('Mọi người sẵn sàng chưa?'),
  wait: tr('Chờ chút nhé'),
  swapHero: tr('Đổi tướng giúp với'),
  letsGo: tr('Vào trận thôi'),
  thanks: tr('Cảm ơn'),
};
