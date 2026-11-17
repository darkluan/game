import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';
import { HEROES, type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { HeroPicker } from '@/ui/HeroPicker';
import { NicknameField } from '@/ui/NicknameField';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

const TEAM_NAMES = ['Đội Xanh', 'Đội Đỏ'] as const;

let pendingLeave: number | undefined;

const title = 'animate-rise text-title text-5xl leading-tight font-black tracking-[0.08em] uppercase sm:text-6xl';
const note = 'text-sm text-muted-foreground';

function TeamColumn({ team, players, myId }: { team: Team; players: LobbyPlayer[]; myId: string | null }) {
  const setTeam = useRoomStore((s) => s.setTeam);
  const mine = players.some((p) => p.playerId === myId);
  const full = players.length >= TEAM_SIZE;
  return (
    <section
      className={`glass-panel flex flex-1 flex-col gap-3 rounded-xl border-t-2! p-4 text-left ${team === 0 ? 'border-t-ally!' : 'border-t-enemy!'}`}
    >
      <h2
        className={`flex items-center justify-between font-extrabold tracking-widest uppercase ${team === 0 ? 'text-ally' : 'text-enemy'}`}
      >
        {TEAM_NAMES[team]}
        <span className="text-xs font-semibold text-muted-foreground">
          {players.length}/{TEAM_SIZE}
        </span>
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {players.map((p) => (
          <li
            key={p.playerId}
            className={`flex items-center gap-2 rounded-md bg-background/70 px-3 py-2 ${p.playerId === myId ? 'ring-1 ring-primary/70' : ''}`}
          >
            <span aria-hidden className={`size-2 shrink-0 rotate-45 ${team === 0 ? 'bg-ally' : 'bg-enemy'}`} />
            <span className="truncate font-semibold">{p.nickname}</span>
            {p.playerId === myId && <span className="text-muted-foreground">(bạn)</span>}
            <span className="truncate text-xs text-muted-foreground">· {HEROES[p.heroId]?.name ?? p.heroId}</span>
            {p.isHost && <span className="ml-auto text-xs whitespace-nowrap text-primary">Chủ phòng</span>}
          </li>
        ))}
        {Array.from({ length: TEAM_SIZE - players.length }, (_, i) => (
          <li key={i} className="rounded-md border border-dashed border-border px-3 py-2 text-muted-foreground">
            Trống (máy sẽ chơi)
          </li>
        ))}
      </ul>
      {!mine && (
        <button
          type="button"
          disabled={full}
          onClick={() => setTeam(team)}
          className="btn btn-ghost rounded-md px-3! py-2! text-xs whitespace-nowrap"
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
    <div className="glass-panel flex w-full animate-rise flex-col gap-2 rounded-xl p-4 text-left [animation-delay:80ms]">
      <p className={note}>Gửi link này cho bạn bè để vào phòng:</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background/70 px-3 py-2 select-all">
          {link}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="btn btn-ghost rounded-md px-4! py-2! text-xs whitespace-nowrap"
        >
          {copied ? 'Đã chép' : 'Chép link'}
        </button>
      </div>
    </div>
  );
}

function Lobby({ code }: { code: string }) {
  const lobby = useRoomStore((s) => s.lobby);
  const myId = useRoomStore((s) => s.playerId);
  useLobbyMusic();
  if (!lobby) return <p className={note}>Đang vào phòng…</p>;

  return (
    <>
      <div>
        <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase">Phòng chờ</p>
        <h1 className={title}>{code}</h1>
      </div>
      <ShareLink code={code} />
      <div className="flex w-full animate-rise flex-col gap-4 [animation-delay:160ms] sm:flex-row">
        {([0, 1] as const).map((team) => (
          <TeamColumn key={team} team={team} players={lobby.players.filter((p) => p.team === team)} myId={myId} />
        ))}
      </div>
    </>
  );
}

function LobbyActions({ onLeave }: { onLeave: () => void }) {
  const lobby = useRoomStore((s) => s.lobby);
  const myId = useRoomStore((s) => s.playerId);
  const matchInProgress = useRoomStore((s) => s.matchInProgress);
  const startMatch = useRoomStore((s) => s.startMatch);
  if (!lobby) return null;
  const iAmHost = lobby.players.some((p) => p.playerId === myId && p.isHost);

  return (
    <div className="flex animate-rise flex-wrap items-center justify-center gap-5 [animation-delay:240ms] lg:justify-start">
      {matchInProgress ? (
        <p className={note}>Trận đang diễn ra. Bạn sẽ chơi được khi trận này kết thúc.</p>
      ) : iAmHost ? (
        <button type="button" onClick={startMatch} className="btn btn-primary cut-corners px-12 text-lg">
          Bắt đầu
        </button>
      ) : (
        <p className={note}>Chờ chủ phòng bấm Bắt đầu…</p>
      )}
      <button type="button" onClick={onLeave} className={`${note} cursor-pointer underline hover:text-foreground`}>
        Rời phòng
      </button>
    </div>
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
  const lobby = useRoomStore((s) => s.lobby);
  const myId = useRoomStore((s) => s.playerId);
  const matchInProgress = useRoomStore((s) => s.matchInProgress);
  const setHero = useRoomStore((s) => s.setHero);

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

  const inLobby = (phase === 'lobby' || phase === 'match') && connectedCode === code;
  const me = inLobby ? lobby?.players.find((p) => p.playerId === myId) : undefined;
  const teammatePicks = (lobby?.players ?? [])
    .filter((p) => p.team === me?.team && p.playerId !== myId)
    .map((p) => p.heroId);
  return (
    <LobbyShell
      heroId={me?.heroId}
      actions={inLobby && <LobbyActions onLeave={goHome} />}
      aside={
        me &&
        !matchInProgress && (
          <HeroPicker label="Chọn tướng của bạn" value={me.heroId} taken={teammatePicks} onChange={setHero} />
        )
      }
    >
      {content()}
    </LobbyShell>
  );

  // The shell stays mounted across these steps, so the backdrop does not restart between them.
  function content() {
    if (phase === 'error') {
      return (
        <>
          <p role="alert" className="glass-panel rounded-xl p-4 text-lg text-danger">
            {error}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void joinRoom(code, nickname)} className="btn btn-primary cut-corners">
              Vào lại
            </button>
            <button type="button" onClick={goHome} className="btn btn-ghost cut-corners">
              Về trang chủ
            </button>
          </div>
        </>
      );
    }
    if (phase === 'connecting') return <p className={note}>Đang kết nối…</p>;
    if (inLobby) return <Lobby code={code} />;

    // Opened from a link: ask for a name before joining. The click also lets the browser start audio.
    return (
      <>
        <div>
          <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase">Vào phòng</p>
          <h1 className={title}>{code}</h1>
        </div>
        <div className="glass-panel flex w-full max-w-md animate-rise flex-col gap-5 rounded-xl p-5 [animation-delay:80ms]">
          <NicknameField />
          <button
            type="button"
            onClick={() => void joinRoom(code, nickname)}
            className="btn btn-primary cut-corners text-lg"
          >
            Vào phòng
          </button>
        </div>
        <button type="button" onClick={goHome} className={`${note} cursor-pointer underline hover:text-foreground`}>
          Về trang chủ
        </button>
      </>
    );
  }
}
