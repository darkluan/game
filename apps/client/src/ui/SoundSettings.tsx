import { tr } from '@/i18n';
import { THEME_IDS, type ThemeId, THEMES } from '@/lib/music';
import { useSettingsStore } from '@/store/settingsStore';

const pill = 'cursor-pointer rounded-full border px-3 py-1 transition-colors hover:text-foreground';

/** Lobby music picker and the sound on/off switch. */
export function SoundSettings() {
  const { muted, toggleMuted, music, setMusic, homeMusic, toggleHomeMusic } = useSettingsStore();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground lg:justify-start">
      <label className="flex items-center gap-2">
        <span className="tracking-widest uppercase">{tr('Nhạc sảnh')}</span>
        <select
          value={music}
          onChange={(e) => setMusic(e.target.value as ThemeId)}
          className="cursor-pointer rounded-full border border-border bg-background/70 px-3 py-1 text-foreground outline-none focus:border-primary"
        >
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {tr(THEMES[id].name)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={`${pill} border-border`}>
        {muted ? tr('Âm thanh: tắt') : tr('Âm thanh: bật')}
      </button>
      {/* On the home screen the music waits for this switch; in a room it always plays. */}
      <button
        type="button"
        onClick={toggleHomeMusic}
        aria-pressed={homeMusic}
        className={`${pill} ${homeMusic ? 'border-primary text-primary' : 'border-border'}`}
      >
        {homeMusic ? tr('Nhạc nền: bật') : tr('Nhạc nền: tắt')}
      </button>
    </div>
  );
}
