import { EN } from './en';

export type Lang = 'vi' | 'en';
export const LANG_NAMES: Record<Lang, string> = { vi: 'Tiếng Việt', en: 'English' };

/** Where the settings store keeps the player's choices, the language among them. */
export const SETTINGS_KEY = 'tu-toc-settings';

/**
 * The language is read once, when the page loads, and changing it reloads the page. That lets any
 * code translate at any time, including constants built when a file is first loaded.
 */
function initialLang(): Lang {
  try {
    const saved = (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { lang?: unknown }).lang;
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    // Storage blocked or corrupted: fall through to the default.
  }
  // Outside a browser (the tests) the game speaks the language it is written in; players start in English.
  return typeof document === 'undefined' ? 'vi' : 'en';
}

export const lang: Lang = initialLang();
if (typeof document !== 'undefined') {
  document.documentElement.lang = lang;
  // The page's own title is written in Vietnamese; show the game's English name on the tab too.
  if (lang === 'en') document.title = EN['Tứ Tộc'] ?? document.title;
}

/**
 * The text in the player's language. The game is written in Vietnamese, and the Vietnamese text is
 * also what the English is looked up by; text with no English yet is shown as it is.
 * `{name}` in the text is replaced by `vars.name`.
 */
export function tr(text: string, vars?: Record<string, string | number>): string {
  const base = lang === 'en' ? (EN[text] ?? text) : text;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}
