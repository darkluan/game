import { useEffect } from 'react';
import { unlockAudio } from '@/lib/audio';
import { startMusic, stopMusic, THEME_IDS, type ThemeId, THEMES } from '@/lib/music';
import { useServerStatus } from '@/net/serverStatus';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';

/** Plays the chosen lobby theme while the menu is on screen. */
function useLobbyMusic(theme: ThemeId): void {
  useEffect(() => {
    // Browsers block audio until the first click or key press, so that is when the music can begin.
    const begin = () => {
      unlockAudio();
      startMusic(theme);
    };
    // Coming back from a match, or switching theme, audio is already unlocked: start right away.
    startMusic(theme);
    window.addEventListener('pointerdown', begin);
    window.addEventListener('keydown', begin);
    return () => {
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
      stopMusic();
    };
  }, [theme]);
}

function ServerStatusLine() {
  const { status, retry } = useServerStatus();
  if (status.state === 'connecting') return <p className="text-sm text-muted-foreground">Đang kết nối máy chủ…</p>;
  if (status.state === 'online') {
    return (
      <p className="text-sm text-hp">
        Máy chủ: đã kết nối ({status.pingMs} ms, {status.tickRate} tick/giây)
      </p>
    );
  }
  return (
    <p className="text-sm text-danger">
      Máy chủ: không kết nối được.{' '}
      <button type="button" onClick={retry} className="underline">
        Thử lại
      </button>
    </p>
  );
}

export function MainMenu() {
  const startOffline = useGameStore((s) => s.startOffline);
  const { muted, toggleMuted, music, setMusic } = useSettingsStore();
  useLobbyMusic(music);
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-6xl font-bold tracking-wide text-primary">Tứ Tộc</h1>
      <p className="max-w-md text-muted-foreground">
        MOBA 3v3 một đường, chơi ngay trên trình duyệt. Bản chơi thử: điều khiển Kael, cùng 2 bot đồng đội đấu với 3 bot
        địch. Phá đền địch để thắng.
      </p>
      <button
        type="button"
        onClick={startOffline}
        className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground"
      >
        Chơi thử với máy
      </button>
      <ServerStatusLine />
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <div role="radiogroup" aria-label="Nhạc sảnh" className="flex items-center gap-2">
          <span>Nhạc sảnh:</span>
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={music === id}
              onClick={() => setMusic(id)}
              className={`rounded-md border px-3 py-1 ${
                music === id ? 'border-primary text-primary' : 'border-border'
              }`}
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
    </main>
  );
}
