import { tr } from '@/i18n';
import { castSlot, castSpell } from '@/input/commands';
import type { AbilityHud, GameSession, SpellHud } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { HeroPortrait } from '../HeroPortrait';
import { RACE_TEXT, raceName } from '../heroText';
import { Minimap } from '../Minimap';
import { GameIcon } from '../icons/GameIcon';
import { PingWheel } from './Pings';
import { QuickChat } from './QuickChat';
import { ItemBag, ShopPanel } from '../Shop';
import {
  AbilityInfo,
  Bar,
  DeathNotice,
  QuickBuy,
  RecallNotice,
  EndScreen,
  EventFeed,
  type LayoutProps,
  ResourceBar,
  Scoreboard,
  StatsGrid,
  TeamBar,
} from './parts';
import { SPELL_TONE } from './spellTone';

/** The player's portrait is underlined in the colour of its race. */
const RACE_FRAME = {
  human: 'border-b-2 border-race-human',
  dragon: 'border-b-2 border-race-dragon',
  god: 'border-b-2 border-race-god',
  machine: 'border-b-2 border-race-machine',
} as const;

/** Shown above an ability while the pointer is over it or its level-up button. */
const TIP =
  'hud-panel pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-72 -translate-x-1/2 rounded-md p-3';

function AbilityButton({ ability, game }: { ability: AbilityHud; game: GameSession }) {
  const learned = ability.level > 0;
  const setAimSlot = useGameStore((s) => s.setAimSlot);
  return (
    // With the pointer over an ability, the scene shows how far it reaches and where it would land.
    <div
      className="relative flex flex-col items-center gap-1"
      onPointerEnter={() => setAimSlot(ability.slot)}
      onPointerLeave={() => setAimSlot(null)}
    >
      {/* peer-hover: the level-up button shows what the next level brings, the ability itself what it has now. */}
      <button
        type="button"
        aria-label={tr('Nâng cấp {name}', { name: ability.name })}
        disabled={!ability.canLevelUp}
        onClick={() => game.send({ t: 'levelUp', slot: ability.slot })}
        className="peer/up h-4 w-8 rounded-sm bg-primary text-xs leading-none font-bold text-primary-foreground disabled:invisible"
      >
        +
      </button>
      <div role="tooltip" className={`${TIP} peer-hover/up:block`}>
        <AbilityInfo ability={ability} next />
        <p className="mt-1 text-[10px] text-primary">{tr('Nâng cấp (Alt+{slot})', { slot: ability.slot })}</p>
      </div>
      <button
        type="button"
        aria-label={`${ability.name} (${ability.slot})`}
        disabled={!ability.usable}
        onClick={() => castSlot(game, ability.slot, null)}
        className={`peer/cast cut-corners-sm relative size-14 overflow-hidden border-2 bg-background text-lg font-bold ${
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
      <div role="tooltip" className={`${TIP} peer-hover/cast:block`}>
        <AbilityInfo ability={ability} />
      </div>
      <span className="max-w-16 truncate text-[10px] text-muted-foreground">{ability.name}</span>
    </div>
  );
}

/** A helper spell: smaller than an ability, with nothing to level up. */
function SpellButton({ spell, game }: { spell: SpellHud; game: GameSession }) {
  return (
    <div className="relative self-center">
      <button
        type="button"
        aria-label={`${spell.name} (${spell.key})`}
        disabled={!spell.usable}
        onClick={() => castSpell(game, spell.id, null)}
        className={`peer/cast relative size-11 overflow-hidden rounded-full border-2 bg-background font-bold ${
          spell.usable ? SPELL_TONE[spell.id].border : 'border-border text-muted-foreground'
        }`}
      >
        {spell.cooldownLeft > 0 && (
          <span
            className="absolute inset-x-0 bottom-0 bg-foreground/25"
            style={{ height: `${spell.cooldownFraction * 100}%` }}
          />
        )}
        <GameIcon
          id={spell.id}
          className={`absolute inset-2 ${spell.usable ? SPELL_TONE[spell.id].icon : 'text-muted-foreground/60'}`}
        />
        {spell.cooldownLeft > 0 && (
          <span className="relative text-sm text-foreground [text-shadow:0_0_4px_#000]">
            {Math.ceil(spell.cooldownLeft)}
          </span>
        )}
        <span className="absolute bottom-0 left-1.5 text-[10px] text-primary [text-shadow:0_0_3px_#000]">
          {spell.key}
        </span>
      </button>
      <div role="tooltip" className={`${TIP} peer-hover/cast:block`}>
        <p className="font-semibold">{spell.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{spell.description}</p>
        {spell.cooldown > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tr('Hồi chiêu {seconds} giây', { seconds: spell.cooldown })}
          </p>
        )}
      </div>
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
      <TeamBar hud={hud} />
      <EventFeed hud={hud} className="top-16 text-sm" />

      <div className="absolute top-2 right-2 flex items-center gap-2">
        <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={corner}>
          {muted ? tr('Âm thanh: tắt') : tr('Âm thanh: bật')}
        </button>
        <button type="button" onClick={toggleGraphics} aria-pressed={graphics === 'high'} className={corner}>
          {graphics === 'high'
            ? tr('Đồ họa: cao')
            : autoLowered
              ? tr('Đồ họa: thấp (tự giảm vì máy chậm)')
              : tr('Đồ họa: thấp')}
        </button>
        <button type="button" onClick={actions.exit} className={corner}>
          {tr('Thoát')}
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
      {/* Above the minimap; its panel opens upward. */}
      <QuickChat game={game} className="bottom-44 left-2" panelClassName="bottom-full left-0 mb-1.5" />
      <PingWheel />

      <p className="absolute right-2 bottom-2 hidden max-w-52 text-right min-[1500px]:block text-[11px] leading-snug text-muted-foreground">
        {tr('Chuột: di chuyển, bấm vào địch để đánh.')}
        <br />
        {tr('Q W E R: chiêu theo con trỏ · Alt + phím: nâng chiêu')}
        <br />
        {tr(
          'D: hồi máu · F: tốc biến · T: biến về · A: vừa đi vừa đánh · S: dừng · B: cửa hàng · giữ Tab: bảng điểm · Enter: chat · Alt + bấm: tín hiệu',
        )}
      </p>

      {/* The console. Three blocks: who you are, what you can do, what you carry. In a window too narrow
          for all of it beside the minimap, the first block keeps to the portrait and the level. */}
      <div className="pointer-events-auto hud-console bottom-0 left-[262px] flex items-stretch min-[1280px]:min-w-[940px] gap-4 px-6 pt-3.5 pb-2 min-[1500px]:left-1/2 min-[1500px]:-translate-x-1/2">
        <div className="flex shrink-0 flex-col justify-between gap-1 text-xs min-[1280px]:w-52">
          <div className="flex items-center gap-2">
            {/* The portrait in a frame of its race's colour, the hero's level pinned to its corner. */}
            <div className="relative shrink-0">
              <HeroPortrait
                heroId={hud.heroDefId}
                className={`cut-corners-sm size-14 shadow-[0_0_14px_rgb(0_0_0/0.8)] ${RACE_FRAME[hud.race]}`}
              />
              <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border border-background bg-primary text-[11px] leading-none font-black text-primary-foreground tabular-nums">
                {hud.level}
              </span>
            </div>
            <div className="max-[1279px]:hidden">
              <p className="text-sm leading-tight font-semibold">{hud.heroName}</p>
              <p className={RACE_TEXT[hud.race]}>{raceName(hud.race)}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 max-[1279px]:hidden">
            <StatsGrid hud={hud} />
            {hud.synergy.map((line) => (
              <p key={line} className="text-[10px] leading-tight text-primary">
                {line}
              </p>
            ))}
          </div>
          <div>
            <p className="text-muted-foreground max-[1279px]:hidden">
              {tr('Cấp {level}', { level: hud.level })}
              {hud.skillPoints > 0 && (
                <span className="ml-1 font-semibold text-primary">
                  {tr('+{points} điểm', { points: hud.skillPoints })}
                </span>
              )}
            </p>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-sm bg-background"
              role="progressbar"
              aria-label={tr('Kinh nghiệm')}
            >
              <div className="h-full bg-xp" style={{ width: `${hud.xpFraction * 100}%` }} />
            </div>
          </div>
        </div>

        <span
          aria-hidden
          className="w-px shrink-0 self-stretch bg-linear-to-b from-transparent via-foreground/25 to-transparent"
        />
        <div className="flex min-w-[28.5rem] flex-1 flex-col gap-1.5">
          <div className="flex items-end justify-center gap-2">
            {hud.abilities.map((a) => (
              <AbilityButton key={a.slot} ability={a} game={game} />
            ))}
            <span aria-hidden className="h-10 w-px self-center bg-border" />
            {hud.spells.map((s) => (
              <SpellButton key={s.id} spell={s} game={game} />
            ))}
          </div>
          <Bar value={hud.hp} max={hud.maxHp} className="bg-hp" label={tr('Máu')} />
          <ResourceBar hud={hud} />
          {(hud.shield > 0 || hud.conditions.length > 0) && (
            <div className="flex flex-wrap gap-x-3 text-xs">
              {hud.shield > 0 && (
                <span className="text-ally">{tr('Khiên {amount}', { amount: Math.ceil(hud.shield) })}</span>
              )}
              {hud.conditions.map((label) => (
                <span key={label} className="text-danger">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <span
          aria-hidden
          className="w-px shrink-0 self-stretch bg-linear-to-b from-transparent via-foreground/25 to-transparent"
        />
        <div className="flex w-52 shrink-0 flex-col justify-between gap-2">
          <ItemBag hud={hud} game={game} columns={3} />
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-bold whitespace-nowrap text-gold tabular-nums">
              <span aria-hidden className="size-3 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />
              {tr('{gold} vàng', { gold: Math.floor(hud.gold) })}
            </span>
            <button
              type="button"
              onClick={toggleShop}
              aria-pressed={shopOpen}
              className={`relative rounded-md border px-2 py-1 text-xs whitespace-nowrap ${hud.suggestion?.affordable ? 'border-gold text-gold' : hud.canShop ? 'border-primary text-primary' : 'border-border'}`}
            >
              {tr('Cửa hàng (B)')}
              {/* Enough gold for the next item: worth a trip home. */}
              {hud.suggestion?.affordable && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 size-2.5 animate-pulse-dot rounded-full bg-gold"
                />
              )}
            </button>
          </div>
        </div>
      </div>

      <QuickBuy hud={hud} game={game} className="absolute bottom-48 left-1/2 -translate-x-1/2" />
      <RecallNotice hud={hud} />
      <DeathNotice hud={hud} />
      <EndScreen hud={hud} actions={actions} />
    </div>
  );
}
