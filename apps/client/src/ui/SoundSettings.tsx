import { THEME_IDS, THEMES } from '@/lib/music';
import { useSettingsStore } from '@/store/settingsStore';

const pill = 'cursor-pointer rounded-full border px-3 py-1 transition-colors hover:text-foreground';

/** Lobby music picker and the sound on/off switch. */
export function SoundSettings() {
  const { muted, toggleMuted, music, setMusic } = useSettingsStore();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground lg:justify-start">
      <div role="radiogroup" aria-label="Nhạc sảnh" className="flex flex-wrap items-center justify-center gap-2">
        <span className="tracking-widest uppercase">Nhạc sảnh</span>
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={music === id}
            onClick={() => setMusic(id)}
            className={`${pill} ${music === id ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
          >
            {THEMES[id].name}
          </button>
        ))}
      </div>
      <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={`${pill} border-border`}>
        Âm thanh: {muted ? 'tắt' : 'bật'}
      </button>
      {!muted && <p>Bấm vào bất kỳ đâu để bật nhạc nền.</p>}
    </div>
  );
}
