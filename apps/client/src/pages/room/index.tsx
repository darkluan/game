import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { NicknameField } from '@/ui/NicknameField';
import { SoundSettings } from '@/ui/SoundSettings';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

const TEAM_NAMES = ['Đội Xanh', 'Đội Đỏ'] as const;

let pendingLeave: number | undefined;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto p-6 text-center">
      {children}
    </main>
  );
}

function TeamColumn({ team, players, myId }: { team: Team; players: LobbyPlayer[]; myId: string | null }) {
  const setTeam = useRoomStore((s) => s.setTeam);
  const mine = players.some((p) => p.playerId === myId);
  const full = players.length >= TEAM_SIZE;
  return (
    <section className="flex w-56 flex-col gap-2 rounded-lg border border-border bg-panel p-3">
      <h2 className={`font-semibold ${team === 0 ? 'text-ally' : 'text-enemy'}`}>{TEAM_NAMES[team]}</h2>
      <ul className="flex flex-col gap-1 text-left text-sm">
        {players.map((p) => (
          <li key={p.playerId} className="rounded-sm bg-background px-2 py-1">
            {p.nickname}
            {p.playerId === myId && <span className="text-muted-foreground"> (bạn)</span>}
            {p.isHost && <span className="text-primary"> · chủ phòng</span>}
          </li>
        ))}
        {Array.from({ length: TEAM_SIZE - players.length }, (_, i) => (
          <li key={i} className="rounded-sm border border-dashed border-border px-2 py-1 text-muted-foreground">
            Trống (máy sẽ chơi)
          </li>
        ))}
      </ul>
      {!mine && (
        <button
          type="button"
          disabled={full}
          onClick={() => setTeam(team)}
          className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-50"
        >
          {full ? 'Đội đã đủ' : 'Sang đội này'}
        </button>
      )}
    </section>
  );
}

function ShareLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/r/${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the link is still on screen to copy by hand.
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-sm text-muted-foreground">Gửi link này cho bạn bè để vào phòng:</p>
      <div className="flex items-center gap-2">
        <code className="rounded-md border border-border bg-background px-3 py-2 select-all">{link}</code>
        <button type="button" onClick={() => void copy()} className="rounded-md border border-border px-3 py-2 text-sm">
          {copied ? 'Đã chép' : 'Chép link'}
        </button>
      </div>
    </div>
  );
}

function Lobby({ code, onLeave }: { code: string; onLeave: () => void }) {
  const lobby = useRoomStore((s) => s.lobby);
  const myId = useRoomStore((s) => s.playerId);
  const matchInProgress = useRoomStore((s) => s.matchInProgress);
  const startMatch = useRoomStore((s) => s.startMatch);
  useLobbyMusic();
  if (!lobby) return <Frame>Đang vào phòng…</Frame>;
  const iAmHost = lobby.players.some((p) => p.playerId === myId && p.isHost);

  return (
    <Frame>
      <h1 className="text-3xl font-bold text-primary">Phòng {code}</h1>
      <ShareLink code={code} />
      <div className="flex flex-wrap justify-center gap-4">
        {([0, 1] as const).map((team) => (
          <TeamColumn key={team} team={team} players={lobby.players.filter((p) => p.team === team)} myId={myId} />
        ))}
      </div>
      {matchInProgress ? (
        <p className="text-sm text-muted-foreground">Trận đang diễn ra. Bạn sẽ chơi được khi trận này kết thúc.</p>
      ) : iAmHost ? (
        <button
          type="button"
          onClick={startMatch}
          className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground"
        >
          Bắt đầu
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">Chờ chủ phòng bấm Bắt đầu…</p>
      )}
      <button type="button" onClick={onLeave} className="text-sm text-muted-foreground underline">
        Rời phòng
      </button>
      <SoundSettings />
    </Frame>
  );
}

export default function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase();
  const navigate = useNavigate();
  const phase = useRoomStore((s) => s.phase);
  const connectedCode = useRoomStore((s) => s.code);
  const error = useRoomStore((s) => s.error);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const backToLobby = useRoomStore((s) => s.backToLobby);
  const leave = useRoomStore((s) => s.leave);
  const game = useGameStore((s) => s.game);
  const nickname = useSettingsStore((s) => s.nickname);

  // Navigating away from the room drops its connections. The leave is deferred one task so that
  // React remounting the page (as StrictMode does in development) cancels it instead of disconnecting.
  useEffect(() => {
    window.clearTimeout(pendingLeave);
    return () => {
      pendingLeave = window.setTimeout(leave, 0);
    };
  }, [leave]);

  const goHome = () => {
    leave();
    void navigate('/');
  };

  if (phase === 'match' && game) {
    return (
      <GameView
        game={game}
        actions={{ exit: goHome, afterMatch: { label: 'Về phòng', run: () => void backToLobby() } }}
      />
    );
  }
  if (phase === 'error') {
    return (
      <Frame>
        <p role="alert" className="text-lg text-danger">
          {error}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void joinRoom(code, nickname)}
            className="rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground"
          >
            Vào lại
          </button>
          <button type="button" onClick={goHome} className="rounded-md border border-border px-5 py-2">
            Về trang chủ
          </button>
        </div>
      </Frame>
    );
  }
  if (phase === 'connecting') return <Frame>Đang kết nối…</Frame>;
  if ((phase === 'lobby' || phase === 'match') && connectedCode === code) return <Lobby code={code} onLeave={goHome} />;

  // Opened from a link: ask for a name before joining. The click also lets the browser start audio.
  return (
    <Frame>
      <h1 className="text-3xl font-bold text-primary">Vào phòng {code}</h1>
      <NicknameField />
      <button
        type="button"
        onClick={() => void joinRoom(code, nickname)}
        className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground"
      >
        Vào phòng
      </button>
      <button type="button" onClick={goHome} className="text-sm text-muted-foreground underline">
        Về trang chủ
      </button>
    </Frame>
  );
}
