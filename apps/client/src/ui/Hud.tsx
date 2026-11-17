import { castSlot } from '@/input/commands';
import type { AbilityHud, GameSession, HudState } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Minimap } from './Minimap';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
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

function AbilityButton({ ability, game }: { ability: AbilityHud; game: GameSession }) {
  const learned = ability.level > 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`Nâng cấp ${ability.name}`}
        title={`Nâng cấp (Alt+${ability.slot})`}
        disabled={!ability.canLevelUp}
        onClick={() => game.send({ t: 'levelUp', slot: ability.slot })}
        className="h-5 w-8 rounded-sm bg-primary text-xs font-bold text-primary-foreground disabled:invisible"
      >
        +
      </button>
      <button
        type="button"
        aria-label={`${ability.name} (${ability.slot})`}
        title={`${ability.name} · ${ability.cost} mana`}
        disabled={!ability.usable}
        onClick={() => castSlot(game, ability.slot, null)}
        className={`relative size-14 overflow-hidden rounded-md border-2 bg-background text-lg font-bold ${
          ability.usable ? 'border-primary' : 'border-border text-muted-foreground'
        }`}
      >
        {learned && ability.cooldownLeft > 0 && (
          <span
            className="absolute inset-x-0 bottom-0 bg-foreground/25"
            style={{ height: `${ability.cooldownFraction * 100}%` }}
          />
        )}
        <span className="relative">
          {learned && ability.cooldownLeft > 0 ? Math.ceil(ability.cooldownLeft) : ability.slot}
        </span>
        <span className="absolute right-1 bottom-0 text-[10px] font-normal text-mana">{ability.cost}</span>
      </button>
      <span className="text-[10px] text-muted-foreground">
        {ability.name} · {ability.level}
      </span>
    </div>
  );
}

function Scoreboard({ hud }: { hud: HudState }) {
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
              {s.team === hud.team ? 'Đồng minh' : 'Địch'} · {s.name}
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

/** What the HUD's buttons do; differs between offline play and a room. */
export interface HudActions {
  /** Leave the match at any time. */
  exit: () => void;
  /** The main button on the end-of-match screen, e.g. play again or back to the room. */
  afterMatch: { label: string; run: () => void };
}

export function Hud({ game, actions }: { game: GameSession; actions: HudActions }) {
  const hud = useGameStore((s) => s.hud);
  const { graphics, muted, toggleGraphics, toggleMuted } = useSettingsStore();
  if (!hud) return null;
  const topButton = 'pointer-events-auto rounded-md border border-border bg-panel px-3 py-1 text-sm';

  return (
    <div className="pointer-events-none absolute inset-0 text-foreground">
      <div className="absolute top-3 left-3">
        <Scoreboard hud={hud} />
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-panel px-4 py-1 text-lg font-semibold tabular-nums">
        {clock(hud.timeSeconds)}
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-3">
        <span className="rounded-md border border-border bg-panel px-3 py-1 font-semibold text-gold tabular-nums">
          {Math.floor(hud.gold)} vàng
        </span>
        <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={topButton}>
          Âm thanh: {muted ? 'tắt' : 'bật'}
        </button>
        <button type="button" onClick={toggleGraphics} aria-pressed={graphics === 'high'} className={topButton}>
          Đồ họa: {graphics === 'high' ? 'cao' : 'thấp'}
        </button>
        <button type="button" onClick={actions.exit} className={topButton}>
          Thoát
        </button>
      </div>

      <div className="absolute right-3 bottom-3">
        <Minimap game={game} />
      </div>

      <p className="absolute bottom-3 left-3 max-w-56 text-xs text-muted-foreground">
        Chuột: di chuyển, bấm vào địch để đánh. Q W E R: dùng chiêu theo con trỏ. Alt + phím: nâng chiêu. S: dừng.
      </p>

      <div className="pointer-events-auto absolute bottom-3 left-1/2 flex w-[420px] max-w-[94vw] -translate-x-1/2 flex-col gap-2 rounded-lg border border-border bg-panel p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{hud.heroName}</span>
          <span className="text-muted-foreground">
            Cấp {hud.level}
            {hud.skillPoints > 0 && (
              <span className="ml-2 font-semibold text-primary">+{hud.skillPoints} điểm chiêu</span>
            )}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          {hud.abilities.map((a) => (
            <AbilityButton key={a.slot} ability={a} game={game} />
          ))}
        </div>
        <Bar value={hud.hp} max={hud.maxHp} className="bg-hp" label="Máu" />
        <Bar value={hud.mana} max={hud.maxMana} className="bg-mana" label="Mana" />
        <div className="h-1 overflow-hidden rounded-sm bg-background" role="progressbar" aria-label="Kinh nghiệm">
          <div className="h-full bg-xp" style={{ width: `${hud.xpFraction * 100}%` }} />
        </div>
        {(hud.shield > 0 || hud.stunned) && (
          <div className="flex gap-3 text-xs">
            {hud.shield > 0 && <span className="text-ally">Khiên {Math.ceil(hud.shield)}</span>}
            {hud.stunned && <span className="text-danger">Bị choáng</span>}
          </div>
        )}
      </div>

      {hud.dead && hud.winner === null && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-panel px-6 py-3 text-center">
          <div className="text-lg font-semibold text-danger">Bạn đã bị hạ gục</div>
          <div className="text-sm text-muted-foreground">Hồi sinh sau {hud.respawnSeconds} giây</div>
        </div>
      )}

      {hud.winner !== null && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-background/70">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-panel px-10 py-8">
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
      )}
    </div>
  );
}
