import { tr } from '@/i18n';
import { reloadHome } from '@/lib/reloadHome';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { LobbyShell } from '@/components/LobbyShell';
import { HEROES, type LobbyPlayer, type Team, TEAM_SIZE } from '@game/core';
import { LOBBY_CHAT_TEXT } from '@/lib/chatText';
import { useGameStore } from '@/store/gameStore';
import { useRoomStore } from '@/store/roomStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { HeroPortrait } from '@/ui/HeroPortrait';
import { HeroStrip } from '@/ui/HeroStrip';
import { ROLE_NAMES } from '@/ui/heroText';
import { NicknameField } from '@/ui/NicknameField';
import { useLobbyMusic } from '@/ui/useLobbyMusic';
import { ChatInput } from '@/ui/ChatInput';

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
                {p.isHost ? (
                  <p className="text-[11px] font-semibold text-primary">{tr('Chủ phòng')}</p>
                ) : (
                  <p className={`text-[11px] font-semibold ${p.ready ? 'text-hp' : 'text-muted-foreground'}`}>
                    {p.ready ? tr('Sẵn sàng') : tr('Chưa sẵn sàng')}
                  </p>
                )}
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
    <div className="flex items-center gap-3 xl:flex-col xl:items-start xl:gap-1 squat:flex-col squat:items-start squat:gap-0.5">
      <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase">{tr('Phòng chờ')}</p>
      <p className="text-xl font-black tracking-[0.2em] select-all squat:text-base">{code}</p>
      <button
        type="button"
        title={link}
        onClick={() => void copy()}
        className="btn btn-ghost ml-auto rounded-md px-3! py-1.5! text-xs whitespace-nowrap xl:ml-0 squat:ml-0 squat:px-2! squat:py-1!"
      >
        {copied ? tr('Đã chép') : tr('Chép link mời')}
      </button>
    </div>
  );
}

/**
 * Chat in the pick room: what was said lately floats above the dock, and Enter (or the button) opens
 * a box to type in. Enter sends; Enter with nothing typed closes the box again.
 */
function RoomChat({ players }: { players: LobbyPlayer[] }) {
  const chat = useRoomStore((s) => s.chat);
  const sendChat = useRoomStore((s) => s.sendChat);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Typing somewhere already (the box itself, a name field): that Enter is not for us.
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <div className="absolute bottom-full left-0 mb-2 flex flex-col items-start gap-1.5 text-xs">
      <ul aria-live="polite" className="pointer-events-none flex flex-col items-start gap-1">
        {chat.map((line) => (
          <li key={line.key} className="glass-panel max-w-xs rounded-md px-2.5 py-1 break-words">
            <span className="font-bold text-primary">
              {players.find((p) => p.playerId === line.playerId)?.nickname ?? '…'}:
            </span>{' '}
            {'id' in line ? LOBBY_CHAT_TEXT[line.id] : line.text}
          </li>
        ))}
      </ul>
      {open ? (
        <div className="glass-panel w-64 rounded-lg p-2">
          {/* Stays open after a line is sent: a conversation is several of them. */}
          <ChatInput autoFocus onCancel={() => setOpen(false)} onSend={(text) => sendChat({ text })} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass-panel cursor-pointer rounded-full px-3 py-1.5 font-bold"
        >
          {tr('Chat (Enter)')}
        </button>
      )}
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
  const setReady = useRoomStore((s) => s.setReady);
  useLobbyMusic(true);
  if (!lobby) return <p className={note}>{tr('Đang vào phòng…')}</p>;
  const me = lobby.players.find((p) => p.playerId === myId);
  const allReady = lobby.players.every((p) => p.ready);
  const teammatePicks = lobby.players.filter((p) => p.team === me?.team && p.playerId !== myId).map((p) => p.heroId);

  return (
    // On a wide screen this is a low dock along the bottom: the room on the left, the heroes in the
    // middle, the start button on the right. On a phone the three stack.
    <div className="glass-panel relative flex w-full animate-rise flex-col gap-3 rounded-xl p-3 xl:flex-row xl:items-center xl:gap-6 xl:pr-28 xl:pl-5 squat:flex-row squat:items-center squat:gap-3 squat:p-2">
      <RoomChat players={lobby.players} />
      <ShareLink code={code} />
      {me && !matchInProgress && (
        <div className="min-w-0 xl:max-w-[60rem] xl:flex-1 squat:flex-1">
          <HeroStrip label={tr('Chọn tướng của bạn')} value={me.heroId} taken={teammatePicks} onChange={setHero} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 xl:ml-auto xl:flex-col xl:gap-2 squat:ml-auto squat:flex-col squat:gap-1">
        {matchInProgress ? (
          <p className={note}>{tr('Trận đang diễn ra. Bạn sẽ chơi được khi trận này kết thúc.')}</p>
        ) : me?.isHost ? (
          <>
            <button
              type="button"
              onClick={startMatch}
              disabled={!allReady}
              className="btn btn-primary cut-corners px-14 py-3! text-lg disabled:cursor-not-allowed disabled:opacity-50 squat:py-2! squat:text-base"
            >
              {tr('Bắt đầu')}
            </button>
            {!allReady && <p className={note}>{tr('Chờ mọi người bấm Sẵn sàng…')}</p>}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setReady(!me?.ready)}
              aria-pressed={me?.ready === true}
              className={`btn cut-corners px-10 py-3! text-lg squat:py-2! squat:text-base ${me?.ready ? 'btn-ghost' : 'btn-primary'}`}
            >
              {me?.ready ? tr('Hủy sẵn sàng') : tr('Sẵn sàng')}
            </button>
            <p className={note}>
              {me?.ready ? tr('Chờ chủ phòng bấm Bắt đầu…') : tr('Bấm Sẵn sàng khi đã chọn xong tướng.')}
            </p>
          </>
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
            {/* After an error the way home is a fresh load, which also picks up a newer version of the game. */}
            <button type="button" onClick={reloadHome} className="btn btn-ghost cut-corners">
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
