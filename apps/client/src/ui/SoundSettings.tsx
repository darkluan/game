import { THEME_IDS, THEMES } from '@/lib/music';
import { useSettingsStore } from '@/store/settingsStore';

/** Lobby music picker and the sound on/off switch. */
export function SoundSettings() {
  const { muted, toggleMuted, music, setMusic } = useSettingsStore();
  return (
    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
      <div role="radiogroup" aria-label="Nhạc sảnh" className="flex flex-wrap items-center justify-center gap-2">
        <span>Nhạc sảnh:</span>
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={music === id}
            onClick={() => setMusic(id)}
            className={`rounded-md border px-3 py-1 ${music === id ? 'border-primary text-primary' : 'border-border'}`}
          >
            {THEMES[id].name}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleMuted}
        aria-pressed={!muted}
        className="rounded-md border border-border px-3 py-1"
      >
        Âm thanh: {muted ? 'tắt' : 'bật'}
      </button>
      {!muted && <p className="text-xs">Bấm vào bất kỳ đâu để bật nhạc nền.</p>}
    </div>
  );
}
