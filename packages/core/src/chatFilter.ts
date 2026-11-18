/** The longest message a player can type. */
export const CHAT_TEXT_MAX = 120;

/**
 * Words replaced by asterisks in typed chat, Vietnamese and English. A basic net, not a moderator:
 * it catches the common ones written plainly. These are compared without accents and in lower case.
 */
const BLOCKED = new Set([
  // Vietnamese shorthand, which has no accents to lose.
  'djt',
  'dmm',
  'dkm',
  'dcm',
  'vcl',
  'vkl',
  'clgt',
  'cmm',
  // English.
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'dick',
  'pussy',
  'nigger',
  'nigga',
  'faggot',
  'retard',
]);

/**
 * Vietnamese words blocked only as written here, accents included. Without their accents they are
 * everyday words ("các" the, "buổi" a part of the day, "lon" a can, "đủ" enough), so those pass.
 */
const BLOCKED_EXACT = new Set(['địt', 'đụ', 'đéo', 'lồn', 'cặc', 'buồi', 'đĩ', 'đm', 'vl']);

const plain = (word: string) =>
  word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

/** Replaces blocked words with asterisks of the same length. */
export function censorChat(text: string): string {
  return text.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const lower = word.toLowerCase().normalize('NFC');
    const bare = plain(word);
    const blocked = BLOCKED_EXACT.has(lower) || BLOCKED.has(bare);
    return blocked ? '*'.repeat([...word].length) : word;
  });
}

/**
 * Makes typed chat from the network safe to show: one line, no control characters, no longer than
 * the limit, blocked words starred out. Returns '' when nothing is left to say.
 */
export function cleanChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Control characters (code points below space, and DEL) become spaces, then runs of space collapse.
  const printable = [...raw].map((ch) => (ch >= ' ' && ch !== '\u007f' ? ch : ' ')).join('');
  const line = printable.replace(/\s+/g, ' ').trim();
  return censorChat([...line].slice(0, CHAT_TEXT_MAX).join('')).trim();
}
