import { tr } from '@/i18n';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';
import { HEROES, type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { HeroPortrait } from '@/ui/HeroPortrait';
import { HeroStrip } from '@/ui/HeroStrip';
import { ROLE_NAMES } from '@/ui/heroText';
import { NicknameField } from '@/ui/NicknameField';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

const TEAM_NAMES = [tr('Đội Xanh'), tr('Đội Đỏ')] as const;

let pendingLeave: number | undefined;

const title = 'animate-rise text-title text-5xl leading-tight font-black tracking-[0.08em] uppercase sm:text-6xl';
const note = 'text-sm text-muted-foreground';

/** One team of the pick room: its three seats down the side of the screen, each showing who sits there and their hero. */
function TeamColumn({ team, players, myId }: { team: Team; players: LobbyPlayer[]; myId: string | null }) {
  const setTeam = useRoomStore((s) => s.setTeam);
  const mine = players.some((p) => p.playerId === myId);
  const full = players.length >= TEAM_SIZE;
  const colour = team === 0 ? 'text-ally' : 'text-enemy';
  return (
    <section
      className={`glass-panel flex animate-rise flex-col gap-2 rounded-xl border-t-2! p-3 text-left squat:gap-1.5 squat:p-2 ${team === 0 ? 'border-t-ally!' : 'border-t-enemy!'}`}
    >
      <h2 className={`flex items-center justify-between text-sm font-extrabold tracking-widest uppercase ${colour}`}>
        {TEAM_NAMES[team]}
        <span className="text-xs font-semibold text-muted-foreground">
          {players.length}/{TEAM_SIZE}
        </span>
      </h2>
      <ul className="flex flex-col gap-2 squat:gap-1.5">
        {players.map((p) => {
          const hero = HEROES[p.heroId];
          return (
            <li
              key={p.playerId}
              className={`flex items-center gap-3 rounded-md bg-background/70 p-2 squat:gap-2 squat:p-1 ${p.playerId === myId ? 'ring-2 ring-primary/80' : ''}`}
            >
              <HeroPortrait
                heroId={p.heroId}
                className={`size-16 shrink-0 rounded-md border-b-2 squat:size-10 ${team === 0 ? 'border-ally' : 'border-enemy'}`}
              />
              <div className="min-w-0 text-sm squat:text-xs">
                <p className="truncate font-bold">
                  {p.nickname}
                  {p.playerId === myId && <span className="ml-1 font-normal text-muted-foreground">{tr('(bạn)')}</span>}
                </p>
                <p className="truncate text-muted-foreground">
                  {hero?.name ?? p.heroId}
                  {hero && <span className="squat:hidden"> · {ROLE_NAMES[hero.role]}</span>}
                </p>
                {p.isHost && <p className="text-[11px] font-semibold text-primary">{tr('Chủ phòng')}</p>}
              </div>
            </li>
          );
        })}
        {Array.from({ length: TEAM_SIZE - players.length }, (_, i) => (
          <li
            key={i}
            className="flex min-h-20 items-center justify-center rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground squat:min-h-12 squat:p-1"
          >
            {/* The first empty seat of the other team is the way across. */}
            {!mine && i === 0 ? (
              <button
                type="button"
                onClick={() => setTeam(team)}
                className={`cursor-pointer font-semibold underline-offset-2 hover:underline ${colour}`}
              >
                {tr('Sang đội này')}
              </button>
            ) : (
              tr('Trống (máy sẽ chơi)')
            )}
          </li>
        ))}
      </ul>
      {!mine && full && <p className="text-center text-xs text-muted-foreground">{tr('Đội đã đủ')}</p>}
    </section>
  );
}

/** The room's code, and a button that copies the link friends join by. */
function ShareLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/r/${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard blocked: the address bar still has the link to copy by hand.
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-3 xl:flex-col xl:items-start xl:gap-1">
      <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase">{tr('Phòng chờ')}</p>
      <p className="text-xl font-black tracking-[0.2em] select-all squat:text-base">{code}</p>
      <button
        type="button"
        title={link}
        onClick={() => void copy()}
        className="btn btn-ghost ml-auto rounded-md px-3! py-1.5! text-xs whitespace-nowrap xl:ml-0"
      >
        {copied ? tr('Đã chép') : tr('Chép link mời')}
      </button>
    </div>
  );
}

/** The middle of the pick room, under the hero: the room's code, the hero choice and the button that starts the match. */
function PickPanel({ code, onLeave }: { code: string; onLeave: () => void }) {
  const lobby = useRoomStore((s) => s.lobby);
  const myId = useRoomStore((s) => s.playerId);
  const matchInProgress = useRoomStore((s) => s.matchInProgress);
  const startMatch = useRoomStore((s) => s.startMatch);
  const setHero = useRoomStore((s) => s.setHero);
  useLobbyMusic();
  if (!lobby) return <p className={note}>{tr('Đang vào phòng…')}</p>;
  const me = lobby.players.find((p) => p.playerId === myId);
  const teammatePicks = lobby.players.filter((p) => p.team === me?.team && p.playerId !== myId).map((p) => p.heroId);

  return (
    // On a wide screen this is a low dock along the bottom: the room on the left, the heroes in the
    // middle, the start button on the right. On a phone the three stack.
    <div className="glass-panel flex w-full animate-rise flex-col gap-3 rounded-xl p-3 xl:flex-row xl:items-center xl:gap-6 xl:pr-28 xl:pl-5 squat:gap-2 squat:p-2">
      <ShareLink code={code} />
      {me && !matchInProgress && (
        <div className="min-w-0 xl:max-w-[60rem] xl:flex-1">
          <HeroStrip label={tr('Chọn tướng của bạn')} value={me.heroId} taken={teammatePicks} onChange={setHero} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 xl:ml-auto xl:flex-col xl:gap-2">
        {matchInProgress ? (
          <p className={note}>{tr('Trận đang diễn ra. Bạn sẽ chơi được khi trận này kết thúc.')}</p>
        ) : me?.isHost ? (
          <button
            type="button"
            onClick={startMatch}
            className="btn btn-primary cut-corners px-14 py-3! text-lg squat:py-2! squat:text-base"
          >
            {tr('Bắt đầu')}
          </button>
        ) : (
          <p className={note}>{tr('Chờ chủ phòng bấm Bắt đầu…')}</p>
        )}
        <button type="button" onClick={onLeave} className={`${note} cursor-pointer underline hover:text-foreground`}>
          {tr('Rời phòng')}
        </button>
      </div>
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
        actions={{ exit: goHome, afterMatch: { label: tr('Về phòng'), run: () => void backToLobby() } }}
      />
    );
  }

  const inLobby = (phase === 'lobby' || phase === 'match') && connectedCode === code;
  const me = inLobby ? lobby?.players.find((p) => p.playerId === myId) : undefined;
  if (inLobby && lobby) {
    // The pick room: a team down each side, the hero and the choice of heroes in the middle.
    return (
      <LobbyShell
        heroId={matchInProgress ? undefined : me?.heroId}
        sides={[
          <TeamColumn key={0} team={0} players={lobby.players.filter((p) => p.team === 0)} myId={myId} />,
          <TeamColumn key={1} team={1} players={lobby.players.filter((p) => p.team === 1)} myId={myId} />,
        ]}
      >
        <PickPanel code={code} onLeave={goHome} />
      </LobbyShell>
    );
  }
  return <LobbyShell>{content()}</LobbyShell>;

  // The shell stays mounted across these steps, so the backdrop does not restart between them.
  function content() {
    if (phase === 'error') {
      return (
        <>
          <p role="alert" className="glass-panel rounded-xl p-4 text-lg text-danger">
            {tr(error ?? '')}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void joinRoom(code, nickname)} className="btn btn-primary cut-corners">
              {tr('Vào lại')}
            </button>
            <button type="button" onClick={goHome} className="btn btn-ghost cut-corners">
              {tr('Về trang chủ')}
            </button>
          </div>
        </>
      );
    }
    if (phase === 'connecting') return <p className={note}>{tr('Đang kết nối…')}</p>;
    if (inLobby) return <p className={note}>{tr('Đang vào phòng…')}</p>;

    // Opened from a link: ask for a name before joining. The click also lets the browser start audio.
    return (
      <>
        <div>
          <p className="animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase">{tr('Vào phòng')}</p>
          <h1 className={title}>{code}</h1>
        </div>
        <div className="glass-panel flex w-full max-w-md animate-rise flex-col gap-5 rounded-xl p-5 [animation-delay:80ms]">
          <NicknameField />
          <button
            type="button"
            onClick={() => void joinRoom(code, nickname)}
            className="btn btn-primary cut-corners text-lg"
          >
            {tr('Vào phòng')}
          </button>
        </div>
        <button type="button" onClick={goHome} className={`${note} cursor-pointer underline hover:text-foreground`}>
          {tr('Về trang chủ')}
        </button>
      </>
    );
  }
}
