import { tr } from '@/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { HeroPicker } from '@/ui/HeroPicker';
import { InstallButton } from '@/ui/InstallButton';
import { NicknameField } from '@/ui/NicknameField';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

function Menu() {
  const navigate = useNavigate();
  const startOffline = useGameStore((s) => s.startOffline);
  const createRoom = useRoomStore((s) => s.createRoom);
  const roomError = useRoomStore((s) => (s.phase === 'error' ? s.error : null));
  const nickname = useSettingsStore((s) => s.nickname);
  const heroId = useSettingsStore((s) => s.heroId);
  const setHeroId = useSettingsStore((s) => s.setHeroId);
  const [creating, setCreating] = useState(false);
  useLobbyMusic();

  const onCreate = async () => {
    setCreating(true);
    const code = await createRoom(nickname);
    setCreating(false);
    if (code) await navigate(`/r/${code}`);
  };

  return (
    <LobbyShell
      heroId={heroId}
      aside={<HeroPicker label={tr('Tướng khi chơi thử với máy')} value={heroId} onChange={setHeroId} />}
      actions={
        <div className="flex w-full max-w-md animate-rise flex-col gap-3 [animation-delay:240ms] squat:grid squat:max-w-none squat:grid-cols-2 squat:gap-2 squat:*:px-2! squat:*:py-2.5! squat:*:text-xs! squat:*:tracking-wider!">
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={creating}
            className="btn btn-primary cut-corners text-lg"
          >
            {creating ? tr('Đang tạo phòng…') : tr('Tạo phòng')}
          </button>
          <button type="button" onClick={() => void navigate('/q')} className="btn btn-ghost cut-corners text-sm">
            {tr('Tìm trận xếp hạng')}
          </button>
          <button type="button" onClick={startOffline} className="btn btn-ghost cut-corners text-sm">
            {tr('Chơi thử với máy')}
          </button>
          <InstallButton />
          {roomError && (
            <p role="alert" className="text-sm text-danger">
              {roomError}
            </p>
          )}
        </div>
      }
    >
      <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase squat:hidden">
        {tr('MOBA 3v3 · Một đường · Chơi ngay trên trình duyệt')}
      </p>
      <h1 className="animate-rise text-title text-7xl leading-none font-black tracking-[0.08em] uppercase [animation-delay:80ms] sm:text-8xl squat:text-4xl">
        {tr('Tứ Tộc')}
      </h1>
      <p className="max-w-md animate-rise text-muted-foreground [animation-delay:120ms] squat:text-xs">
        {tr('Tạo phòng rồi gửi link cho bạn bè, ô trống sẽ do máy điều khiển. Phá đền địch để thắng.')}
      </p>
      <div className="glass-panel w-full max-w-md animate-rise rounded-xl p-5 [animation-delay:160ms] squat:max-w-none squat:p-2.5">
        <NicknameField />
      </div>
    </LobbyShell>
  );
}

export default function HomePage() {
  const game = useGameStore((s) => s.game);
  const startOffline = useGameStore((s) => s.startOffline);
  const quit = useGameStore((s) => s.quit);
  if (!game) return <Menu />;
  return (
    <GameView game={game} tutorial actions={{ exit: quit, afterMatch: { label: tr('Chơi lại'), run: startOffline } }} />
  );
}
