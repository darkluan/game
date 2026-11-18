import { type Lang, LANG_NAMES, tr } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

/** How each language is written on the switch. */
const SHORT: Record<Lang, string> = { en: 'EN', vi: 'VN' };
const ORDER: readonly Lang[] = ['en', 'vi'];

/** The language choice, as a compact "EN | VN" switch. Choosing the other one reloads the page. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useSettingsStore((s) => s.lang);
  const setLang = useSettingsStore((s) => s.setLang);
  return (
    <div
      role="radiogroup"
      aria-label={tr('Ngôn ngữ')}
      className={`glass-panel flex items-center divide-x divide-border rounded-full px-1 py-1 text-xs font-bold ${className}`}
    >
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={lang === id}
          aria-label={LANG_NAMES[id]}
          lang={id}
          onClick={() => setLang(id)}
          className="cursor-pointer px-2.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground aria-checked:text-primary"
        >
          {SHORT[id]}
        </button>
      ))}
    </div>
  );
}
