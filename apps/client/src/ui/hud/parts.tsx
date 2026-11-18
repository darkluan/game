import type { GameSession, HudState } from '@/lib/session';
import { RELIC_EFFECTS, RELIC_NAMES } from '../relicText';
import type { HudActions } from '../Hud';
import { clock } from './format';

export function Bar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className: string;
  label: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemax={Math.round(max)}
      className="relative h-5 overflow-hidden rounded-sm border border-border bg-background"
    >
      <div className={`h-full ${className}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {Math.ceil(value)} / {Math.round(max)}
      </span>
    </div>
  );
}

/** Mana for humans and gods, the Heat gauge for machines, and the dragon's form in place of a bar. */
export function ResourceBar({ hud }: { hud: HudState }) {
  if (hud.resource === 'mana') {
    return (
      <>
        <Bar value={hud.mana} max={hud.maxMana} className="bg-mana" label="Mana" />
        {hud.race === 'god' && (
          <p className="text-xs text-muted-foreground">
            Tín đồ ở gần: <span className="font-semibold text-race-god">{hud.followers}</span> / 5
          </p>
        )}
      </>
    );
  }
  if (hud.resource === 'heat') {
    const overloaded = hud.overloadSeconds > 0;
    return (
      <div
        role="progressbar"
        aria-label="Nhiệt"
        aria-valuenow={hud.heat}
        aria-valuemax={100}
        className="relative h-5 overflow-hidden rounded-sm border border-border bg-background"
      >
        <div
          className={`h-full ${overloaded ? 'bg-danger' : hud.heat > 50 ? 'bg-race-dragon' : 'bg-gold'}`}
          style={{ width: `${hud.heat}%` }}
        />
        {/* Above this mark abilities hit harder. */}
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-foreground/60" />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
          {overloaded ? `QUÁ TẢI ${hud.overloadSeconds} giây` : `Nhiệt ${hud.heat} / 100`}
        </span>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Chiêu không tốn gì · Tiến hóa: <span className="font-semibold text-race-dragon">{hud.stage} / 2</span>
      {hud.stage < 2 && ` (lần tới ở cấp ${hud.stage === 0 ? 5 : 9})`}
    </p>
  );
}

const TONE_TEXT = { good: 'text-hp', bad: 'text-danger', neutral: 'text-gold' } as const;

/** Relic status, team buffs and the latest announcements, stacked under the match clock. */
export function EventFeed({ hud, className }: { hud: HudState; className: string }) {
  const relic = hud.relic;
  return (
    <div
      className={`absolute left-1/2 flex w-[30rem] max-w-[60vw] -translate-x-1/2 flex-col items-center gap-1 text-center ${className}`}
    >
      {relic && (
        <p className="rounded-md border border-border bg-panel px-3 py-1 text-gold">
          Di vật {RELIC_NAMES[relic.type]} đang sáng ở rừng dưới
          {relic.capturing &&
            ` · ${relic.capturing === 'mine' ? 'đội bạn' : 'đội địch'} đang chiếm ${Math.round(relic.progress * 100)}%`}
        </p>
      )}
      {hud.buffs.map((buff) => (
        <p
          key={`${buff.type}${buff.mine}`}
          title={RELIC_EFFECTS[buff.type]}
          className={`rounded-md border border-border bg-panel px-3 py-1 tabular-nums ${buff.mine ? 'text-hp' : 'text-danger'}`}
        >
          {buff.mine ? 'Đội bạn' : 'Đội địch'} có Di vật {RELIC_NAMES[buff.type]} · {buff.seconds} giây
        </p>
      ))}
      <ul aria-live="polite" className="flex flex-col items-center gap-1">
        {hud.announcements.map((a) => (
          <li key={a.id} className={`rounded-md bg-panel px-3 py-1 font-semibold ${TONE_TEXT[a.tone]}`}>
            {a.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Scoreboard({ hud }: { hud: HudState }) {
  return (
    <table className="rounded-md border border-border bg-panel text-xs tabular-nums">
      <caption className="sr-only">Bảng điểm</caption>
      <thead>
        <tr className="text-muted-foreground">
          <th className="px-2 py-1 text-left font-normal">Tướng</th>
          <th className="px-2 py-1 font-normal">Cấp</th>
          <th className="px-2 py-1 font-normal">H / C / T</th>
        </tr>
      </thead>
      <tbody>
        {hud.scores.map((s) => (
          <tr key={s.id} className={s.team === hud.team ? 'text-ally' : 'text-enemy'}>
            <td className={`px-2 py-0.5 ${s.isPlayer ? 'font-bold' : ''}`}>
              {s.heroName} · {s.name}
            </td>
            <td className="px-2 py-0.5 text-center">{s.level}</td>
            <td className="px-2 py-0.5 text-center">
              {s.kills} / {s.deaths} / {s.assists}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DeathNotice({ hud }: { hud: HudState }) {
  if (!hud.dead || hud.winner !== null) return null;
  return (
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-panel px-6 py-3 text-center">
      <div className="text-lg font-semibold text-danger">Bạn đã bị hạ gục</div>
      <div className="text-sm text-muted-foreground">Hồi sinh sau {hud.respawnSeconds} giây</div>
    </div>
  );
}

export function EndScreen({ hud, actions }: { hud: HudState; actions: HudActions }) {
  if (hud.winner === null) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/70">
      <div className="flex max-h-full flex-col items-center gap-4 overflow-y-auto rounded-lg border border-border bg-panel px-10 py-6">
        <h2 className={`text-4xl font-bold ${hud.winner === hud.team ? 'text-primary' : 'text-danger'}`}>
          {hud.winner === hud.team ? 'Chiến thắng' : 'Thất bại'}
        </h2>
        <p className="text-sm text-muted-foreground">Thời gian trận: {clock(hud.timeSeconds)}</p>
        <Scoreboard hud={hud} />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={actions.afterMatch.run}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            {actions.afterMatch.label}
          </button>
          <button type="button" onClick={actions.exit} className="rounded-md border border-border px-4 py-2">
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

/** Things both layouts need from the session besides the HUD state. */
export interface LayoutProps {
  game: GameSession;
  hud: HudState;
  actions: HudActions;
}
