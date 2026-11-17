import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useServerStatus } from '@/net/serverStatus';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { NicknameField } from '@/ui/NicknameField';
import { SoundSettings } from '@/ui/SoundSettings';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

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

function Menu() {
  const navigate = useNavigate();
  const startOffline = useGameStore((s) => s.startOffline);
  const createRoom = useRoomStore((s) => s.createRoom);
  const roomError = useRoomStore((s) => (s.phase === 'error' ? s.error : null));
  const nickname = useSettingsStore((s) => s.nickname);
  const [creating, setCreating] = useState(false);
  useLobbyMusic();

  const onCreate = async () => {
    setCreating(true);
    const code = await createRoom(nickname);
    setCreating(false);
    if (code) await navigate(`/r/${code}`);
  };

  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
      <h1 className="text-6xl font-bold tracking-wide text-primary">Tứ Tộc</h1>
      <p className="max-w-md text-muted-foreground">
        MOBA 3v3 một đường, chơi ngay trên trình duyệt. Tạo phòng rồi gửi link cho bạn bè, ô trống sẽ do máy điều khiển.
        Phá đền địch để thắng.
      </p>
      <NicknameField />
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={creating}
          className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
        >
          {creating ? 'Đang tạo phòng…' : 'Tạo phòng'}
        </button>
        <button type="button" onClick={startOffline} className="rounded-md border border-border px-8 py-3 text-lg">
          Chơi thử với máy
        </button>
      </div>
      {roomError && (
        <p role="alert" className="text-sm text-danger">
          {roomError}
        </p>
      )}
      <ServerStatusLine />
      <SoundSettings />
    </main>
  );
}

export default function HomePage() {
  const game = useGameStore((s) => s.game);
  const startOffline = useGameStore((s) => s.startOffline);
  const quit = useGameStore((s) => s.quit);
  if (!game) return <Menu />;
  return <GameView game={game} actions={{ exit: quit, afterMatch: { label: 'Chơi lại', run: startOffline } }} />;
}
