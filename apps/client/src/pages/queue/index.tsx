import { tr, trServer } from '@/i18n';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HEROES, PARTY_MAX_SIZE, type QueueStatus } from '@game/core';
import { LobbyShell } from '@/components/LobbyShell';
import { useGameStore } from '@/store/gameStore';
import { useQueueStore } from '@/store/queueStore';
import { useSettingsStore } from '@/store/settingsStore';
import { GameView } from '@/ui/GameView';
import { GoogleSignIn } from '@/ui/GoogleSignIn';
import { HeroPicker } from '@/ui/HeroPicker';
import { NicknameField } from '@/ui/NicknameField';
import { useLobbyMusic } from '@/ui/useLobbyMusic';

let pendingLeave: number | undefined;

const eyebrow = 'animate-rise text-xs font-bold tracking-[0.35em] text-primary uppercase';
const title = 'animate-rise text-title text-5xl leading-tight font-black tracking-[0.08em] uppercase sm:text-6xl';
const note = 'text-sm text-muted-foreground';
const panel = 'glass-panel flex w-full flex-col gap-3 rounded-xl p-4 text-left';

function Party({ status }: { status: QueueStatus }) {
  const createParty = useQueueStore((s) => s.createParty);
  const leaveParty = useQueueStore((s) => s.leaveParty);
  const [copied, setCopied] = useState(false);
  const party = status.party;
  if (!party) {
    return (
      <div className={panel}>
        <p className={note}>
          {tr('Muốn chơi cùng bạn bè? Lập nhóm tối đa {max} người, cả nhóm luôn cùng đội.', { max: PARTY_MAX_SIZE })}
        </p>
        <button type="button" onClick={createParty} className="btn btn-ghost rounded-md px-4! py-2! text-xs">
          {tr('Lập nhóm')}
        </button>
      </div>
    );
  }
  const link = `${window.location.origin}/q?party=${party.code}`;
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
    <div className={panel}>
      <p className={note}>
        {tr('Nhóm của bạn ({count}/{max}). Gửi link này để mời:', { count: party.members.length, max: PARTY_MAX_SIZE })}
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background/70 px-3 py-2 select-all">
          {link}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="btn btn-ghost rounded-md px-4! py-2! text-xs whitespace-nowrap"
        >
          {copied ? tr('Đã chép') : tr('Chép link')}
        </button>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {party.members.map((m, i) => (
          <li key={i} className="rounded-md bg-background/70 px-3 py-1.5 font-semibold">
            {m.nickname}
            {m.isYou && <span className="font-normal text-muted-foreground"> {tr('(bạn)')}</span>}
            {i === 0 && <span className="float-right text-xs font-normal text-primary">{tr('Trưởng nhóm')}</span>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={leaveParty}
        className={`${note} cursor-pointer self-start underline hover:text-foreground`}
      >
        {tr('Rời nhóm')}
      </button>
    </div>
  );
}

function Idle({ status }: { status: QueueStatus }) {
  const find = useQueueStore((s) => s.find);
  const profile = useQueueStore((s) => s.profile);
  const config = useQueueStore((s) => s.config);
  const result = useQueueStore((s) => s.result);
  const google = useQueueStore((s) => s.google);
  const heroId = useSettingsStore((s) => s.heroId);
  // The server refreshes these countdowns with every status it sends, about once a second.
  const banned = status.penaltySeconds;
  const waitsForLeader = status.party !== null && !status.party.isLeader;
  const change = result ? result.mmrAfter - result.mmrBefore : 0;
  return (
    <>
      <div>
        <p className={eyebrow}>{tr('Đấu xếp hạng')}</p>
        <h1 className={title}>{tr('Tìm trận')}</h1>
      </div>
      <p className={`${panel} animate-rise [animation-delay:80ms]`}>
        <span>
          {tr('Điểm trình độ (MMR):')} <span className="font-bold text-primary tabular-nums">{status.mmr}</span>
          {profile && <span className={note}> · {tr('{count} trận xếp hạng', { count: profile.gamesPlayed })}</span>}
        </span>
        {result && (
          <span className={change >= 0 ? 'text-hp' : 'text-danger'}>
            {tr('Trận vừa rồi:')} {result.mmrBefore} → {result.mmrAfter} ({change >= 0 ? '+' : ''}
            {change})
          </span>
        )}
      </p>
      <Party status={status} />
      {banned > 0 ? (
        <p role="alert" className="text-danger">
          {tr('Bạn đang bị khóa tìm trận vì đã thoát trận. Còn {minutes} phút.', { minutes: Math.ceil(banned / 60) })}
        </p>
      ) : waitsForLeader ? (
        <p className={note}>{tr('Chờ trưởng nhóm bấm Tìm trận…')}</p>
      ) : (
        <button type="button" onClick={() => find(heroId)} className="btn btn-primary cut-corners px-12 text-lg">
          {tr('Tìm trận')}
        </button>
      )}
      {config?.googleClientId && profile && !profile.google && (
        <div className={panel}>
          <p className={note}>{tr('Đăng nhập Google để giữ điểm khi đổi máy hoặc trình duyệt.')}</p>
          <GoogleSignIn clientId={config.googleClientId} onCredential={(credential) => void google(credential)} />
        </div>
      )}
      {profile?.google && <p className={note}>{tr('Đã đăng nhập Google: điểm của bạn được giữ khi đổi máy.')}</p>}
    </>
  );
}

function Searching({ status }: { status: QueueStatus }) {
  const cancel = useQueueStore((s) => s.cancel);
  const search = status.searching!;
  const toBots = Math.max(0, search.botFillSeconds - search.waitedSeconds);
  return (
    <>
      <div>
        <p className={eyebrow}>{tr('Đang tìm trận')}</p>
        <h1 className={`${title} tabular-nums`}>
          {Math.floor(search.waitedSeconds / 60)}:{String(search.waitedSeconds % 60).padStart(2, '0')}
        </h1>
      </div>
      <p className={`${panel} animate-rise`}>
        <span>
          {tr('Đang tìm đối thủ trong khoảng ±{range} MMR quanh {mmr}.', { range: search.range, mmr: status.mmr })}
        </span>
        <span className={note}>
          {toBots > 0
            ? tr('Nếu chưa đủ người, sau {seconds} giây nữa các ô trống sẽ do máy điều khiển.', { seconds: toBots })
            : tr('Sắp vào trận với máy lấp các ô trống.')}
        </span>
      </p>
      <button type="button" onClick={cancel} className="btn btn-ghost cut-corners">
        {tr('Hủy tìm trận')}
      </button>
    </>
  );
}

function Accept({ status }: { status: QueueStatus }) {
  const accept = useQueueStore((s) => s.accept);
  const decline = useQueueStore((s) => s.decline);
  const check = status.accept!;
  const left = check.secondsLeft;
  return (
    <>
      <div>
        <p className={eyebrow}>{tr('Đã tìm thấy trận')}</p>
        <h1 className={`${title} tabular-nums`}>{left}</h1>
      </div>
      <p className={note}>
        {tr('{accepted}/{total} người đã chấp nhận.', { accepted: check.accepted, total: check.total })}
      </p>
      {check.youAccepted ? (
        <p className="text-hp">{tr('Bạn đã chấp nhận. Đang chờ những người còn lại…')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={accept} className="btn btn-primary cut-corners px-12 text-lg">
            {tr('Chấp nhận')}
          </button>
          <button type="button" onClick={decline} className="btn btn-ghost cut-corners">
            {tr('Từ chối')}
          </button>
        </div>
      )}
    </>
  );
}

function Draft({ status }: { status: QueueStatus }) {
  const pickHero = useQueueStore((s) => s.pickHero);
  const ready = useQueueStore((s) => s.ready);
  const draft = status.draft!;
  const left = draft.secondsLeft;
  const mine = draft.picks.find((p) => p.isYou);
  const taken = draft.picks.filter((p) => !p.isYou).map((p) => p.heroId);
  return (
    <>
      <div>
        <p className={eyebrow}>{tr('Chọn tướng · còn {seconds} giây', { seconds: left })}</p>
        <h1 className={title}>{draft.team === 0 ? tr('Đội Xanh') : tr('Đội Đỏ')}</h1>
      </div>
      <ul className={`${panel} text-sm`}>
        {draft.picks.map((p, i) => (
          <li key={i} className="flex justify-between rounded-md bg-background/70 px-3 py-1.5">
            <span className="font-semibold">
              {p.nickname}
              {p.isYou && <span className="font-normal text-muted-foreground"> {tr('(bạn)')}</span>}
            </span>
            <span className="text-primary">{HEROES[p.heroId]?.name ?? p.heroId}</span>
          </li>
        ))}
        {draft.bots > 0 && (
          <li className={note}>
            {tr('Trận này có {count} ô do máy điều khiển, nên điểm thay đổi ít hơn.', { count: draft.bots })}
          </li>
        )}
      </ul>
      {mine && (
        <div className="glass-panel w-full rounded-xl p-4">
          <HeroPicker label={tr('Tướng của bạn')} value={mine.heroId} taken={taken} onChange={pickHero} />
        </div>
      )}
      {draft.youReady ? (
        <p className="text-hp">{tr('Đã sẵn sàng. Trận sẽ bắt đầu khi mọi người xong hoặc hết giờ.')}</p>
      ) : (
        <button type="button" onClick={ready} className="btn btn-primary cut-corners px-12 text-lg">
          {tr('Sẵn sàng')}
        </button>
      )}
    </>
  );
}

export default function QueuePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const partyCode = params.get('party')?.toUpperCase();
  const phase = useQueueStore((s) => s.phase);
  const status = useQueueStore((s) => s.status);
  const notice = useQueueStore((s) => s.notice);
  const error = useQueueStore((s) => s.error);
  const connect = useQueueStore((s) => s.connect);
  const leave = useQueueStore((s) => s.leave);
  const game = useGameStore((s) => s.game);
  const nickname = useSettingsStore((s) => s.nickname);
  useLobbyMusic();

  // Navigating away drops the queue connection. Deferred one task so a remount (StrictMode) cancels it.
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
  const join = () => void connect(nickname, partyCode);

  if (phase === 'match' && game) {
    return <GameView game={game} actions={{ exit: goHome, afterMatch: { label: tr('Về hàng chờ'), run: join } }} />;
  }
  return <LobbyShell>{content()}</LobbyShell>;

  // The shell stays mounted across these steps, so the backdrop does not restart between them.
  function content() {
    if (phase === 'connecting') return <p className={note}>{tr('Đang kết nối…')}</p>;
    if (phase === 'error') {
      return (
        <>
          <p role="alert" className="glass-panel rounded-xl p-4 text-lg text-danger">
            {trServer(error ?? '')}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={join} className="btn btn-primary cut-corners">
              {tr('Thử lại')}
            </button>
            <button type="button" onClick={goHome} className="btn btn-ghost cut-corners">
              {tr('Về trang chủ')}
            </button>
          </div>
        </>
      );
    }
    if (phase === 'queue' && status) {
      const Step = { idle: Idle, searching: Searching, accept: Accept, draft: Draft, starting: null }[status.state];
      return (
        <>
          {Step ? <Step status={status} /> : <p className={note}>{tr('Đang vào trận…')}</p>}
          {notice && status.state !== 'draft' && (
            <p role="status" className="text-sm text-gold">
              {trServer(notice)}
            </p>
          )}
          {status.state === 'idle' && (
            <button type="button" onClick={goHome} className={`${note} cursor-pointer underline hover:text-foreground`}>
              {tr('Về trang chủ')}
            </button>
          )}
        </>
      );
    }
    // First visit: ask for a name. The click also lets the browser start audio.
    return (
      <>
        <div>
          <p className={eyebrow}>{tr('Đấu xếp hạng')}</p>
          <h1 className={title}>{partyCode ? tr('Vào nhóm') : tr('Tìm trận')}</h1>
        </div>
        <p className={note}>{tr('Ghép với người lạ có trình độ gần bạn. Chờ quá lâu thì máy sẽ lấp các ô trống.')}</p>
        <div className="glass-panel flex w-full max-w-md animate-rise flex-col gap-5 rounded-xl p-5">
          <NicknameField />
          <button type="button" onClick={join} className="btn btn-primary cut-corners text-lg">
            {partyCode ? tr('Vào nhóm') : tr('Vào hàng chờ')}
          </button>
        </div>
        <button type="button" onClick={goHome} className={`${note} cursor-pointer underline hover:text-foreground`}>
          {tr('Về trang chủ')}
        </button>
      </>
    );
  }
}
