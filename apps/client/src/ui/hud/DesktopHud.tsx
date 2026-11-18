import { castSlot } from '@/input/commands';
import type { AbilityHud, GameSession, HudState } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { HeroPortrait } from '../HeroPortrait';
import { RACE_TEXT, raceName } from '../heroText';
import { Minimap } from '../Minimap';
import { GameIcon } from '../icons/GameIcon';
import { ItemBag, ShopPanel } from '../Shop';
import { clock, teamKills } from './format';
import { Bar, DeathNotice, EndScreen, EventFeed, type LayoutProps, ResourceBar, Scoreboard } from './parts';

/** The player's portrait is underlined in the colour of its race. */
const RACE_FRAME = {
  human: 'border-b-2 border-race-human',
  dragon: 'border-b-2 border-race-dragon',
  god: 'border-b-2 border-race-god',
  machine: 'border-b-2 border-race-machine',
} as const;

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
        className="h-4 w-8 rounded-sm bg-primary text-xs leading-none font-bold text-primary-foreground disabled:invisible"
      >
        +
      </button>
      <button
        type="button"
        aria-label={`${ability.name} (${ability.slot})`}
        title={`${ability.name}: ${ability.description}`}
        disabled={!ability.usable}
        onClick={() => castSlot(game, ability.slot, null)}
        className={`cut-corners-sm relative size-14 overflow-hidden border-2 bg-background text-lg font-bold ${
          ability.usable
            ? 'border-primary shadow-[inset_0_0_14px_color-mix(in_srgb,var(--primary)_45%,transparent)]'
            : 'border-border text-muted-foreground'
        }`}
      >
        {learned && ability.cooldownLeft > 0 && (
          <span
            className="absolute inset-x-0 bottom-0 bg-foreground/25"
            style={{ height: `${ability.cooldownFraction * 100}%` }}
          />
        )}
        <GameIcon
          id={ability.id}
          className={`absolute inset-1 ${ability.usable ? 'text-foreground' : 'text-muted-foreground/60'}`}
        />
        {learned && ability.cooldownLeft > 0 && (
          <span className="relative text-xl text-foreground [text-shadow:0_0_4px_#000]">
            {Math.ceil(ability.cooldownLeft)}
          </span>
        )}
        <span className="absolute bottom-0 left-1 text-[11px] font-bold text-primary [text-shadow:0_0_3px_#000]">
          {ability.slot}
        </span>
        {ability.cost > 0 && (
          <span className="absolute right-1 bottom-0 text-[10px] font-normal text-mana">{ability.cost}</span>
        )}
        {/* One pip per point spent. */}
        <span className="absolute top-0.5 left-1 text-[9px] font-normal text-gold">{'•'.repeat(ability.level)}</span>
      </button>
      <span className="max-w-16 truncate text-[10px] text-muted-foreground">{ability.name}</span>
    </div>
  );
}

/** The six heroes across the top: the player's team on the left, the clock and kill counts in the middle. */
function TopBar({ hud }: { hud: HudState }) {
  const [mine, theirs] = teamKills(hud);
  const chips = (own: boolean) =>
    hud.scores
      .filter((s) => (s.team === hud.team) === own)
      .map((s) => (
        <span
          key={s.id}
          title={`${s.heroName} · ${s.name} · ${s.kills}/${s.deaths}/${s.assists}`}
          className={`cut-corners-sm relative block size-12 border-b-2 bg-background ${
            own ? 'border-ally' : 'border-enemy'
          } ${s.isPlayer ? 'outline-2 -outline-offset-2 outline-primary' : ''}`}
        >
          <HeroPortrait heroId={s.heroDefId} className="size-full" />
          <span className="absolute right-0 bottom-0 bg-background/85 px-1 text-[10px] leading-tight font-bold tabular-nums">
            {s.level}
          </span>
        </span>
      ));
  return (
    <div className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-b-lg hud-panel border-t-0 px-3 py-1.5">
      <div className="flex gap-1">{chips(true)}</div>
      <div className="flex items-center gap-3 px-2 text-lg font-bold tabular-nums">
        <span className="text-ally">{mine}</span>
        <span className="text-base font-semibold">{clock(hud.timeSeconds)}</span>
        <span className="text-enemy">{theirs}</span>
      </div>
      <div className="flex gap-1">{chips(false)}</div>
    </div>
  );
}

/**
 * Mouse-and-keyboard layout: heroes and clock along the top, the minimap bottom left, and one wide
 * console along the bottom holding the hero, its abilities and bars, and its items.
 */
export function DesktopHud({ game, hud, actions }: LayoutProps) {
  const { graphics, muted, toggleGraphics, toggleMuted, autoLowered } = useSettingsStore();
  const shopOpen = useGameStore((s) => s.shopOpen);
  const toggleShop = useGameStore((s) => s.toggleShop);
  const scoreboardOpen = useGameStore((s) => s.scoreboardOpen);
  const corner = 'pointer-events-auto rounded-md hud-panel px-2 py-1 text-xs';

  return (
    <div className="pointer-events-none absolute inset-0 text-foreground">
      <TopBar hud={hud} />
      <EventFeed hud={hud} className="top-16 text-sm" />

      <div className="absolute top-2 right-2 flex items-center gap-2">
        <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={corner}>
          Âm thanh: {muted ? 'tắt' : 'bật'}
        </button>
        <button type="button" onClick={toggleGraphics} aria-pressed={graphics === 'high'} className={corner}>
          Đồ họa: {graphics === 'high' ? 'cao' : autoLowered ? 'thấp (tự giảm vì máy chậm)' : 'thấp'}
        </button>
        <button type="button" onClick={actions.exit} className={corner}>
          Thoát
        </button>
      </div>

      {scoreboardOpen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2">
          <Scoreboard hud={hud} />
        </div>
      )}
      {shopOpen && <ShopPanel hud={hud} game={game} onClose={toggleShop} />}

      <div className="absolute bottom-2 left-2">
        <Minimap game={game} />
      </div>

      <p className="absolute right-2 bottom-2 max-w-52 text-right text-[11px] leading-snug text-muted-foreground">
        Chuột: di chuyển, bấm vào địch để đánh.
        <br />
        Q W E R: chiêu theo con trỏ · Alt + phím: nâng chiêu
        <br />
        S: dừng · B: cửa hàng · giữ Tab: bảng điểm
      </p>

      {/* The console. Three blocks: who you are, what you can do, what you carry. */}
      <div className="pointer-events-auto absolute bottom-0 left-1/2 flex max-w-[calc(100vw-560px)] min-w-[620px] -translate-x-1/2 items-stretch gap-3 rounded-t-lg hud-panel border-b-0 border-t-primary/60 px-3 pt-2 pb-2">
        <div className="flex w-40 flex-col justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <HeroPortrait
              heroId={hud.heroDefId}
              className={`cut-corners-sm size-14 shrink-0 ${RACE_FRAME[hud.race]}`}
            />
            <div>
              <p className="text-sm leading-tight font-semibold">{hud.heroName}</p>
              <p className={RACE_TEXT[hud.race]}>{raceName(hud.race)}</p>
            </div>
          </div>
          {hud.synergy.map((line) => (
            <p key={line} className="text-[10px] leading-tight text-primary">
              {line}
            </p>
          ))}
          <div>
            <p className="text-muted-foreground">
              Cấp {hud.level}
              {hud.skillPoints > 0 && <span className="ml-1 font-semibold text-primary">+{hud.skillPoints} điểm</span>}
            </p>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-sm bg-background"
              role="progressbar"
              aria-label="Kinh nghiệm"
            >
              <div className="h-full bg-xp" style={{ width: `${hud.xpFraction * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="flex min-w-72 flex-1 flex-col gap-1.5">
          <div className="flex justify-center gap-3">
            {hud.abilities.map((a) => (
              <AbilityButton key={a.slot} ability={a} game={game} />
            ))}
          </div>
          <Bar value={hud.hp} max={hud.maxHp} className="bg-hp" label="Máu" />
          <ResourceBar hud={hud} />
          {(hud.shield > 0 || hud.conditions.length > 0) && (
            <div className="flex flex-wrap gap-x-3 text-xs">
              {hud.shield > 0 && <span className="text-ally">Khiên {Math.ceil(hud.shield)}</span>}
              {hud.conditions.map((label) => (
                <span key={label} className="text-danger">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-44 flex-col justify-between gap-2">
          <ItemBag hud={hud} game={game} columns={3} />
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gold tabular-nums">{Math.floor(hud.gold)} vàng</span>
            <button
              type="button"
              onClick={toggleShop}
              aria-pressed={shopOpen}
              className={`rounded-md border px-2 py-1 text-xs ${hud.canShop ? 'border-primary text-primary' : 'border-border'}`}
            >
              Cửa hàng (B)
            </button>
          </div>
        </div>
      </div>

      <DeathNotice hud={hud} />
      <EndScreen hud={hud} actions={actions} />
    </div>
  );
}
