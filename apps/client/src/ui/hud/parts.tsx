import { tr } from '@/i18n';
import type { AbilityHud, GameSession, HudState } from '@/lib/session';
import { HeroPortrait } from '../HeroPortrait';
import { ItemIcon } from '../icons/ItemIcon';
import { RELIC_EFFECTS, RELIC_NAMES } from '../relicText';
import type { HudActions } from '../Hud';
import { clock, teamKills } from './format';

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
      className="relative h-5 overflow-hidden rounded-sm border border-border bg-background shadow-[inset_0_2px_4px_rgb(0_0_0/0.8)]"
    >
      <div className={`relative h-full ${className}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }}>
        {/* A sheen along the top of what is left, and a shadow under it: a filled glass tube, not a flat strip. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.4),transparent_45%,rgb(0_0_0/0.3))]"
        />
      </div>
      {/* A notch every tenth, so a glance gives the share that is left. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(10%_-_1px),rgb(0_0_0/0.4)_calc(10%_-_1px),rgb(0_0_0/0.4)_10%)]"
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums [text-shadow:0_1px_2px_#000]">
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
            {tr('Tín đồ ở gần:')} <span className="font-semibold text-race-god">{hud.followers}</span> / 5
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
        aria-label={tr('Nhiệt')}
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
          {overloaded
            ? tr('QUÁ TẢI {seconds} giây', { seconds: hud.overloadSeconds })
            : tr('Nhiệt {heat} / 100', { heat: hud.heat })}
        </span>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {tr('Chiêu không tốn gì · Tiến hóa:')} <span className="font-semibold text-race-dragon">{hud.stage} / 2</span>
      {hud.stage < 2 && ` ${tr('(lần tới ở cấp {level})', { level: hud.stage === 0 ? 5 : 9 })}`}
    </p>
  );
}

/**
 * The six heroes across the top of the screen: the player's team on the left, the clock and kill
 * counts in the middle. Each portrait carries the hero's level and health, and greys out while dead.
 * `compact` is the phone's version, small enough to sit between the minimap and the buttons.
 */
export function TeamBar({ hud, compact = false }: { hud: HudState; compact?: boolean }) {
  const [mine, theirs] = teamKills(hud);
  const chips = (own: boolean) =>
    hud.scores
      .filter((s) => (s.team === hud.team) === own)
      .map((s) => (
        <span
          key={s.id}
          title={`${s.heroName} · ${s.name} · ${s.kills}/${s.deaths}/${s.assists}`}
          className={`relative block bg-background ${compact ? 'size-8 overflow-hidden rounded-sm' : 'cut-corners-sm size-12'} ${
            s.isPlayer ? 'outline-2 -outline-offset-2 outline-primary' : ''
          }`}
        >
          <HeroPortrait heroId={s.heroDefId} className={`size-full ${s.dead ? 'opacity-40 grayscale' : ''}`} />
          {/* Health left, in the team's colour. */}
          <span aria-hidden className={`absolute inset-x-0 bottom-0 bg-background/90 ${compact ? 'h-1' : 'h-1.5'}`}>
            <span
              className={`block h-full ${own ? 'bg-hp' : 'bg-enemy'}`}
              style={{ width: `${Math.max(0, Math.min(1, s.hpFraction)) * 100}%` }}
            />
          </span>
          <span
            className={`absolute top-0 right-0 bg-background/85 leading-tight font-bold tabular-nums ${compact ? 'px-0.5 text-[8px]' : 'px-1 text-[10px]'}`}
          >
            {s.level}
          </span>
        </span>
      ));
  return (
    <div
      className={`hud-panel absolute left-1/2 flex -translate-x-1/2 items-center ${
        compact ? 'top-1 gap-1.5 rounded-md px-1.5 py-1' : 'top-0 gap-2 rounded-b-lg border-t-0 px-3 py-1.5'
      }`}
    >
      <div className="flex gap-1">{chips(true)}</div>
      <div
        className={`flex items-center font-bold tabular-nums ${compact ? 'gap-1.5 px-1 text-sm' : 'gap-3 px-2 text-lg'}`}
      >
        <span className="text-ally">{mine}</span>
        <span className={compact ? '' : 'text-base font-semibold'}>{clock(hud.timeSeconds)}</span>
        <span className="text-enemy">{theirs}</span>
      </div>
      <div className="flex gap-1">{chips(false)}</div>
    </div>
  );
}

/** The hero's fighting numbers, as a small grid. */
export function StatsGrid({ hud, className = '' }: { hud: HudState; className?: string }) {
  const stats = hud.stats;
  if (!stats) return null;
  const rows: [label: string, value: string][] = [
    [tr('Tấn công'), String(stats.attack)],
    [tr('Giáp'), String(stats.armor)],
    [tr('Tốc đánh'), `${stats.attackSpeed.toFixed(2)}/s`],
    [tr('Tốc chạy'), stats.moveSpeed.toFixed(1)],
    [tr('Tầm đánh'), stats.attackRange.toFixed(1)],
    [tr('Sức phép'), `${Math.round(stats.abilityPower * 100)}%`],
  ];
  return (
    <dl className={`grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] leading-tight ${className}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-1">
          <dt className="truncate text-muted-foreground">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One number per ability level, the level the hero has now marked, and the next one when shown for a level-up. */
function LevelValues({ values, level, next }: { values: (string | number)[]; level: number; next: boolean }) {
  // The same at every level: say it once.
  if (values.every((v) => v === values[0])) return <span className="font-semibold">{values[0]}</span>;
  return (
    <span className="tabular-nums">
      {values.map((value, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground"> / </span>}
          <span
            className={
              next && i === level
                ? 'font-bold text-primary'
                : i === level - 1
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground'
            }
          >
            {value}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * An ability's numbers laid out for reading before a match: what stays the same at every level as
 * a row of small tags, and what grows with the ability as a table with one column per level.
 */
function NumbersTable({ ability }: { ability: AbilityHud }) {
  const rows: { label: string; values: (string | number)[] }[] = [
    ...ability.details,
    { label: tr('Hồi chiêu (giây)'), values: ability.cooldowns },
    ...(ability.costs.length > 0 ? [{ label: tr('Tiêu hao'), values: ability.costs }] : []),
    ...(ability.range > 0 ? [{ label: tr('Tầm'), values: [ability.range] }] : []),
  ];
  const fixed = rows.filter((row) => row.values.every((v) => v === row.values[0]));
  const growing = rows.filter((row) => !fixed.includes(row));
  const levels = growing[0]?.values.length ?? 0;
  return (
    <div className="mt-1.5 flex flex-col gap-2 border-t border-border pt-2">
      {fixed.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {fixed.map((row) => (
            <li key={row.label} className="rounded-md bg-foreground/8 px-2 py-0.5">
              <span className="text-muted-foreground">{row.label}</span>{' '}
              <span className="font-semibold text-foreground">{row.values[0]}</span>
            </li>
          ))}
        </ul>
      )}
      {growing.length > 0 && (
        <table className="w-full border-separate border-spacing-y-0.5 tabular-nums">
          <thead>
            <tr className="text-[10px] tracking-wider text-muted-foreground uppercase">
              <th className="text-left font-normal">{tr('Theo cấp chiêu')}</th>
              {Array.from({ length: levels }, (_, i) => (
                <th key={i} className="w-14 text-right font-semibold">
                  {tr('Cấp {level}', { level: i + 1 })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {growing.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="rounded-l-md bg-foreground/5 px-2 py-0.5 text-left font-normal text-muted-foreground"
                >
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={i}
                    className={`bg-foreground/5 px-2 py-0.5 text-right font-semibold ${i === row.values.length - 1 ? 'rounded-r-md text-primary' : 'text-foreground'}`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * Everything about one ability: what it does and its numbers at every level. With `next`, the
 * level a point would buy is highlighted, which is what the level-up button shows.
 */
export function AbilityInfo({
  ability,
  next = false,
  preview = false,
  numbers = true,
}: {
  ability: AbilityHud;
  next?: boolean;
  /** Outside a match: no level to show, and the numbers laid out in two columns. */
  preview?: boolean;
  /** False leaves out the table of numbers, keeping the name and what the ability does. */
  numbers?: boolean;
}) {
  const maxLevel = ability.cooldowns.length;
  const row = 'flex justify-between gap-3';
  return (
    <div className="flex flex-col gap-1 text-left text-xs font-normal">
      <p className="flex items-baseline justify-between gap-3 text-sm font-semibold text-foreground">
        {ability.name}
        {!preview && (
          <span className="text-xs font-normal text-muted-foreground">
            {next && ability.level < maxLevel
              ? tr('Cấp {from} → {to}', { from: ability.level, to: ability.level + 1 })
              : tr('Cấp {level} / {max}', { level: ability.level, max: maxLevel })}
          </span>
        )}
      </p>
      <p className="text-muted-foreground">{ability.description}</p>
      {numbers && preview && <NumbersTable ability={ability} />}
      {numbers && !preview && (
        <>
          <div className={`mt-1 border-t border-border pt-1 flex flex-col gap-0.5`}>
            {ability.details.map((detail) => (
              <p key={detail.label} className={row}>
                <span className="text-muted-foreground">{detail.label}</span>
                <LevelValues values={detail.values} level={ability.level} next={next} />
              </p>
            ))}
            <p className={row}>
              <span className="text-muted-foreground">{tr('Hồi chiêu (giây)')}</span>
              <LevelValues values={ability.cooldowns} level={ability.level} next={next} />
            </p>
            {ability.costs.length > 0 && (
              <p className={row}>
                <span className="text-muted-foreground">{tr('Tiêu hao')}</span>
                <LevelValues values={ability.costs} level={ability.level} next={next} />
              </p>
            )}
            {ability.range > 0 && (
              <p className={row}>
                <span className="text-muted-foreground">{tr('Tầm')}</span>
                <span className="font-semibold">{ability.range}</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{tr('Số đậm: cấp hiện tại. Số vàng: cấp kế tiếp.')}</p>
        </>
      )}
    </div>
  );
}

const TONE_TEXT = { good: 'text-hp', bad: 'text-danger', neutral: 'text-gold', chat: 'text-ally' } as const;

/** Relic status, team buffs and the latest announcements, stacked under the match clock. */
export function EventFeed({ hud, className }: { hud: HudState; className: string }) {
  const relic = hud.relic;
  return (
    <div
      className={`absolute left-1/2 flex w-[30rem] max-w-[60vw] -translate-x-1/2 flex-col items-center gap-1 text-center ${className}`}
    >
      {relic && (
        <p className="rounded-md hud-panel px-3 py-1 text-gold">
          {tr('Di vật {relic} đang sáng ở rừng dưới', { relic: RELIC_NAMES[relic.type] })}
          {relic.capturing &&
            ` · ${tr(relic.capturing === 'mine' ? 'đội bạn đang chiếm {percent}%' : 'đội địch đang chiếm {percent}%', { percent: Math.round(relic.progress * 100) })}`}
        </p>
      )}
      {hud.buffs.map((buff) => (
        <p
          key={`${buff.type}${buff.mine}`}
          title={RELIC_EFFECTS[buff.type]}
          className={`rounded-md hud-panel px-3 py-1 tabular-nums ${buff.mine ? 'text-hp' : 'text-danger'}`}
        >
          {tr(
            buff.mine ? 'Đội bạn có Di vật {relic} · {seconds} giây' : 'Đội địch có Di vật {relic} · {seconds} giây',
            {
              relic: RELIC_NAMES[buff.type],
              seconds: buff.seconds,
            },
          )}
        </p>
      ))}
      <ul aria-live="polite" className="flex flex-col items-center gap-1">
        {hud.announcements.map((a) => (
          <li key={a.id} className={`hud-panel rounded-md px-3 py-1 font-semibold break-words ${TONE_TEXT[a.tone]}`}>
            {a.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Scoreboard({ hud }: { hud: HudState }) {
  return (
    <table className="rounded-md hud-panel text-xs tabular-nums">
      <caption className="sr-only">{tr('Bảng điểm')}</caption>
      <thead>
        <tr className="text-muted-foreground">
          <th className="px-2 py-1 text-left font-normal">{tr('Tướng')}</th>
          <th className="px-2 py-1 font-normal">{tr('Cấp')}</th>
          <th className="px-2 py-1 font-normal">H / C / T</th>
        </tr>
      </thead>
      <tbody>
        {hud.scores.map((s) => (
          <tr key={s.id} className={s.team === hud.team ? 'text-ally' : 'text-enemy'}>
            <td className={`px-2 py-0.5 ${s.isPlayer ? 'font-bold' : ''}`}>
              <span className="flex items-center gap-2">
                <HeroPortrait heroId={s.heroDefId} className="size-6 rounded-sm" />
                {s.heroName} · {s.name}
              </span>
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

/** Shown while the hero channels a recall: how long is left, filling up as it goes. */
export function RecallNotice({ hud }: { hud: HudState }) {
  if (!hud.recall || hud.dead) return null;
  return (
    <div className="absolute top-[62%] left-1/2 w-44 -translate-x-1/2 rounded-md hud-panel px-3 py-1.5 text-center text-xs">
      <div className="font-semibold text-ally">{tr('Đang biến về… {seconds}', { seconds: hud.recall.seconds })}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-background">
        <div className="h-full bg-ally" style={{ width: `${hud.recall.fraction * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * One tap to buy the next item worth having. Shown only when the shop is in reach and the gold is
 * there, so it never needs a second look.
 */
export function QuickBuy({ hud, game, className }: { hud: HudState; game: GameSession; className: string }) {
  const item = hud.suggestion;
  if (!item?.affordable || !hud.canShop) return null;
  return (
    <button
      type="button"
      onPointerDown={() => game.send({ t: 'buy', itemId: item.id })}
      className={`pointer-events-auto flex touch-none items-center gap-1.5 rounded-md border border-gold bg-background/90 px-2 py-1 text-xs font-semibold text-gold ${className}`}
    >
      <ItemIcon id={item.id} className="size-6" />
      {tr('Mua {name}', { name: item.name })}
      <span className="tabular-nums">{item.price}</span>
    </button>
  );
}

/** `hint`: something the player can do while waiting, said under the countdown. */
export function DeathNotice({ hud, hint }: { hud: HudState; hint?: string }) {
  if (!hud.dead || hud.winner !== null) return null;
  return (
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-md hud-panel px-6 py-3 text-center">
      <div className="text-lg font-semibold text-danger">{tr('Bạn đã bị hạ gục')}</div>
      <div className="text-sm text-muted-foreground">
        {tr('Hồi sinh sau {seconds} giây', { seconds: hud.respawnSeconds })}
      </div>
      {hint && <div className="mt-1 text-xs text-primary">{hint}</div>}
    </div>
  );
}

export function EndScreen({ hud, actions }: { hud: HudState; actions: HudActions }) {
  if (hud.winner === null) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/70">
      <div className="flex max-h-full flex-col items-center gap-4 overflow-y-auto rounded-lg hud-panel px-10 py-6">
        <h2 className={`text-4xl font-bold ${hud.winner === hud.team ? 'text-primary' : 'text-danger'}`}>
          {hud.winner === hud.team ? tr('Chiến thắng') : tr('Thất bại')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tr('Thời gian trận: {time}', { time: clock(hud.timeSeconds) })}
        </p>
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
            {tr('Về trang chủ')}
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
