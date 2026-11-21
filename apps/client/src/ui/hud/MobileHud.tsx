import { tr } from '@/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AbilitySlot, ITEMS, type Vec2 } from '@game/core';
import { attackNearest, castSlot, castSpell, haltHere, moveInDirection } from '@/input/commands';
import type { AbilityHud, GameSession, HudState, SpellHud } from '@/lib/session';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useGameStore } from '@/store/gameStore';
import { launchedAsApp } from '@/lib/install';
import { useSettingsStore } from '@/store/settingsStore';
import { HeroPortrait } from '../HeroPortrait';
import { Minimap } from '../Minimap';
import { GameIcon } from '../icons/GameIcon';
import { ItemIcon } from '../icons/ItemIcon';
import { ItemBag, ShopPanel } from '../Shop';
import {
  AbilityInfo,
  EndScreen,
  EventFeed,
  type LayoutProps,
  QuickBuy,
  RecallNotice,
  Scoreboard,
  StatsGrid,
  TeamBar,
} from './parts';
import { SPELL_TONE } from './spellTone';
import { AIM_CANCEL_ID, useAimDrag } from './useAimDrag';
import { Joystick } from './Joystick';
import { PingButtons } from './Pings';
import { QuickChat } from './QuickChat';

/** How far the attack button looks for a target. */
const ATTACK_SEARCH_RANGE = 12;

/** Where each ability sits around the attack button: offsets from the bottom-right corner, in pixels. */
const ABILITY_SPOTS: Record<string, { right: number; bottom: number; size: number }> = {
  Q: { right: 108, bottom: 4, size: 58 },
  W: { right: 92, bottom: 74, size: 58 },
  E: { right: 22, bottom: 110, size: 58 },
  R: { right: 168, bottom: 62, size: 66 },
};

/** Where the helper spells and recall sit: smaller, tucked into the gaps of the ability ring. */
const SPELL_SPOTS: Record<string, { right: number; bottom: number }> = {
  heal: { right: 172, bottom: 6 },
  flash: { right: 96, bottom: 140 },
  recall: { right: 180, bottom: 138 },
};
const SPELL_SIZE = 48;

function RoundSpell({ spell, game }: { spell: SpellHud; game: GameSession }) {
  const spot = SPELL_SPOTS[spell.id];
  const aim = useAimDrag(game, 'flash', (at) => castSpell(game, 'flash', at));
  return (
    <button
      type="button"
      aria-label={spell.name}
      disabled={!spell.usable}
      // The flash is aimed by dragging, like an ability; a tap sends it the way the hero faces. The
      // other two have nothing to aim and go at a touch.
      {...(spell.id === 'flash' ? aim : { onPointerDown: () => castSpell(game, spell.id, null) })}
      style={{ right: spot.right, bottom: spot.bottom, width: SPELL_SIZE, height: SPELL_SIZE }}
      className={`pointer-events-auto absolute touch-none overflow-hidden rounded-full border-2 bg-panel text-sm font-bold ${
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
        className={`absolute inset-2.5 ${spell.usable ? SPELL_TONE[spell.id].icon : 'text-muted-foreground/60'}`}
      />
      {spell.cooldownLeft > 0 && (
        <span className="relative [text-shadow:0_0_4px_#000]">{Math.ceil(spell.cooldownLeft)}</span>
      )}
    </button>
  );
}

/**
 * Where a cast being aimed can be called off: it appears once the finger has left the button, and a
 * finger lifted on it casts nothing. It lights up while the finger is over it.
 */
function AimCancel() {
  const aiming = useGameStore((s) => s.aimSlot !== null && s.aimOffset !== null);
  const over = useGameStore((s) => s.aimCancel);
  if (!aiming) return null;
  return (
    <div
      id={AIM_CANCEL_ID}
      className={`absolute top-[5.5rem] right-[13.5rem] flex size-14 items-center justify-center rounded-full border-2 text-[10px] font-bold uppercase ${
        over ? 'scale-110 border-danger bg-danger text-background' : 'border-danger bg-panel/80 text-danger'
      }`}
    >
      {tr('Hủy')}
    </div>
  );
}

/** A finger must rest on an ability this long before its card shows: a quick tap to cast should not flash it. */
const CARD_AFTER_MS = 180;

/**
 * What an ability does, shown beside the buttons while a finger holds it, as phone games of this
 * kind do. It goes with the drawing on the ground and is gone when the finger lifts.
 */
function AbilityCard({
  hud,
  hidden,
}: {
  hud: HudState;
  /** Another panel has the same place on the screen. */ hidden: boolean;
}) {
  const held = useGameStore((s) => s.aimSlot);
  const [shown, setShown] = useState<typeof held>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(held), held ? CARD_AFTER_MS : 0);
    return () => window.clearTimeout(timer);
  }, [held]);
  const ability = hud.abilities.find((a) => a.slot === shown && a.slot === held);
  if (hidden || !ability) return null;
  return (
    <div className="pointer-events-none absolute right-[16.5rem] bottom-24 z-20 flex max-h-[calc(100dvh-7rem)] w-64 flex-col gap-1 overflow-hidden rounded-lg hud-sheet p-2 text-xs">
      <AbilityInfo ability={ability} />
    </div>
  );
}

/** Holding + this long shows the next level instead of buying it. */
const HOLD_TO_PREVIEW_MS = 350;

function RoundAbility({
  ability,
  game,
  onPreview,
}: {
  ability: AbilityHud;
  game: GameSession;
  /** The player is holding +: show what the next level brings. */
  onPreview: (slot: AbilitySlot) => void;
}) {
  const spot = ABILITY_SPOTS[ability.slot];
  // An ability that cannot be cast yet (not learned, still cooling) can still be held, to read what
  // it does; lifting the finger then casts nothing.
  const aim = useAimDrag(game, ability.slot, (at) => {
    if (ability.usable) castSlot(game, ability.slot, at);
  });
  const hold = useRef<number | undefined>(undefined);
  const cooling = ability.level > 0 && ability.cooldownLeft > 0;
  return (
    <div className="absolute" style={{ right: spot.right, bottom: spot.bottom, width: spot.size, height: spot.size }}>
      <button
        type="button"
        aria-label={ability.name}
        aria-disabled={!ability.usable}
        // Hold to read it and see where it would land, drag to aim it, lift to cast; see useAimDrag.
        {...aim}
        className={`pointer-events-auto relative size-full touch-none overflow-hidden rounded-full border-2 bg-panel text-sm font-bold ${
          ability.usable
            ? 'border-primary shadow-[inset_0_0_14px_color-mix(in_srgb,var(--primary)_45%,transparent)]'
            : 'border-border text-muted-foreground'
        }`}
      >
        {cooling && (
          <span
            className="absolute inset-x-0 bottom-0 bg-foreground/25"
            style={{ height: `${ability.cooldownFraction * 100}%` }}
          />
        )}
        <GameIcon
          id={ability.id}
          className={`absolute inset-2 ${ability.usable ? 'text-foreground' : 'text-muted-foreground/60'}`}
        />
        {cooling && (
          <span className="relative text-lg [text-shadow:0_0_4px_#000]">{Math.ceil(ability.cooldownLeft)}</span>
        )}
      </button>
      {ability.canLevelUp && (
        <button
          type="button"
          aria-label={tr('Nâng cấp {name}', { name: ability.name })}
          // A tap spends the point at once, as in other games of the kind; holding shows what it would buy.
          onPointerDown={() => {
            hold.current = window.setTimeout(() => {
              hold.current = undefined;
              onPreview(ability.slot);
            }, HOLD_TO_PREVIEW_MS);
          }}
          onPointerUp={() => {
            if (hold.current === undefined) return;
            window.clearTimeout(hold.current);
            hold.current = undefined;
            game.send({ t: 'levelUp', slot: ability.slot });
          }}
          onPointerCancel={() => {
            window.clearTimeout(hold.current);
            hold.current = undefined;
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-auto absolute -top-2 -left-2 size-7 touch-none rounded-full bg-primary text-base leading-none font-bold text-primary-foreground"
        >
          +
        </button>
      )}
    </div>
  );
}

/** Slim bars: on a phone there is no room for the desktop console. */
function Vitals({ hud }: { hud: HudState }) {
  const resource =
    hud.resource === 'mana'
      ? { fraction: hud.mana / Math.max(1, hud.maxMana), className: 'bg-mana' }
      : hud.resource === 'heat'
        ? {
            fraction: hud.heat / 100,
            className: hud.overloadSeconds > 0 ? 'bg-danger' : hud.heat > 50 ? 'bg-race-dragon' : 'bg-gold',
          }
        : null;
  return (
    <div className="absolute bottom-2 left-1/2 flex w-[38vw] -translate-x-1/2 items-end gap-2">
      <HeroPortrait heroId={hud.heroDefId} className="cut-corners-sm size-10 shrink-0 border-b-2 border-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* What the hero carries, always in view. Selling is done in the menu, so a stray tap here does nothing. */}
        <div className="flex gap-1" aria-label={tr('Túi đồ')}>
          {Array.from({ length: hud.itemSlots }, (_, i) => {
            const item = ITEMS[hud.items[i]];
            return (
              <span
                key={i}
                className={`flex size-6 items-center justify-center rounded-sm border bg-background/70 ${
                  item ? 'border-border text-gold' : 'border-dashed border-border/60'
                }`}
              >
                {item && <ItemIcon id={item.id} className="size-full" />}
              </span>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] font-semibold tabular-nums">
          <span>
            {tr('Cấp {level}', { level: hud.level })}
            {hud.resource === 'none' && (
              <span className="text-race-dragon"> · {tr('Tiến hóa {stage}/2', { stage: hud.stage })}</span>
            )}
            {hud.overloadSeconds > 0 && <span className="text-danger"> {tr('· QUÁ TẢI')}</span>}
          </span>
          <span>
            {Math.ceil(hud.hp)} / {hud.maxHp}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-sm border border-border bg-background"
          role="progressbar"
          aria-label={tr('Máu')}
        >
          <div className="h-full bg-hp" style={{ width: `${Math.min(100, (hud.hp / hud.maxHp) * 100)}%` }} />
        </div>
        {resource && (
          <div className="h-1.5 overflow-hidden rounded-sm bg-background">
            <div
              className={`h-full ${resource.className}`}
              style={{ width: `${Math.min(100, resource.fraction * 100)}%` }}
            />
          </div>
        )}
        {hud.conditions.length > 0 && (
          <p className="text-center text-[11px] text-danger">{hud.conditions.join(' · ')}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Touch layout: a thumbstick bottom left to walk, an attack button with the four abilities around it
 * bottom right, and only the essentials elsewhere. Abilities aim themselves at the nearest enemy.
 */
export function MobileHud({ game, hud, actions }: LayoutProps) {
  const { graphics, muted, toggleGraphics, toggleMuted, autoLowered } = useSettingsStore();
  const shopOpen = useGameStore((s) => s.shopOpen);
  const toggleShop = useGameStore((s) => s.toggleShop);
  const [menuOpen, setMenuOpen] = useState(false);
  const [previewSlot, setPreviewSlot] = useState<AbilitySlot | null>(null);
  // Gone once the point is spent or the ability can no longer be raised.
  const preview = hud.abilities.find((a) => a.slot === previewSlot && a.canLevelUp);
  const fullscreen = useFullscreen();
  // An installed app already fills the screen and is already sideways.
  const installed = launchedAsApp;
  const offerFullscreen = fullscreen.supported && !fullscreen.active && !installed;
  // The stick walks the hero; with the hero dead it slides the view over the map instead.
  const walk = useCallback(
    (dir: Vec2) => {
      if (game.hero.dead) useGameStore.getState().setPanDir(dir);
      else moveInDirection(game, dir);
    },
    [game],
  );
  const halt = useCallback(() => {
    useGameStore.getState().setPanDir(null);
    if (!game.hero.dead) haltHere(game);
  }, [game]);
  const chip = 'pointer-events-auto touch-none rounded-md hud-panel px-2.5 py-1.5 text-xs';
  const option = 'rounded-md border border-border px-3 py-2';

  return (
    // Kept clear of the notch and the rounded corners of a phone held sideways.
    <div className="pointer-events-none absolute top-[env(safe-area-inset-top)] right-[env(safe-area-inset-right)] bottom-[env(safe-area-inset-bottom)] left-[env(safe-area-inset-left)] text-foreground select-none">
      <div className="absolute top-1 left-1 origin-top-left scale-[0.62]">
        <Minimap game={game} />
      </div>

      {/* Under the minimap; its panel opens beside it. */}
      <QuickChat game={game} className="top-[4.75rem] left-1" panelClassName="top-full left-0 mt-1.5" />
      <PingButtons game={game} className="top-[4.75rem] left-16" />

      <TeamBar hud={hud} compact />
      <EventFeed
        hud={hud}
        deathHint={tr('Đẩy cần điều khiển hoặc chạm bản đồ nhỏ để xem trận')}
        className="top-12 text-[11px]"
      />

      <div className="absolute top-1 right-1 flex items-center gap-1.5">
        <span className="rounded-md hud-panel px-2.5 py-1.5 text-xs font-semibold text-gold tabular-nums">
          {Math.floor(hud.gold)}
        </span>
        <button
          type="button"
          onPointerDown={toggleShop}
          aria-pressed={shopOpen}
          className={`${chip} relative ${hud.suggestion?.affordable ? 'border-gold text-gold' : hud.canShop ? 'border-primary text-primary' : ''}`}
        >
          {tr('Cửa hàng')}
          {/* Enough gold for the next item: worth a trip home. */}
          {hud.suggestion?.affordable && (
            <span aria-hidden className="absolute -top-1 -right-1 size-2.5 animate-pulse-dot rounded-full bg-gold" />
          )}
        </button>
        {offerFullscreen && (
          // click, not pointerdown: browsers only allow going full screen from a finished tap.
          <button
            type="button"
            onClick={() => void fullscreen.enter()}
            className={`${chip} border-primary text-primary`}
          >
            {tr('Toàn màn hình')}
          </button>
        )}
        <button
          type="button"
          onPointerDown={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className={chip}
        >
          Menu
        </button>
      </div>

      {menuOpen && (
        // Above the ability buttons, which sit in the same corner.
        <div className="pointer-events-auto absolute top-11 right-1 z-20 flex max-h-[calc(100dvh-3.25rem)] w-[min(34rem,calc(100vw-0.5rem))] flex-col gap-2 overflow-y-auto rounded-lg hud-sheet p-2 text-xs">
          {/* Settings first: they must be reachable without scrolling. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={toggleMuted} className={option}>
              {muted ? tr('Âm thanh: tắt') : tr('Âm thanh: bật')}
            </button>
            <button type="button" onClick={toggleGraphics} aria-pressed={graphics === 'high'} className={option}>
              {graphics === 'high' ? tr('Đồ họa: cao') : tr('Đồ họa: thấp')}
            </button>
            {fullscreen.supported && !installed && (
              // click, not pointerdown: browsers only allow going full screen from a finished tap.
              <button
                type="button"
                onClick={fullscreen.active ? fullscreen.leave : () => void fullscreen.enter()}
                aria-pressed={fullscreen.active}
                className={option}
              >
                {fullscreen.active ? tr('Thoát toàn màn hình') : tr('Toàn màn hình')}
              </button>
            )}
            <button type="button" onClick={actions.exit} className={`${option} text-danger`}>
              {tr('Thoát trận')}
            </button>
          </div>
          {autoLowered && graphics === 'low' && (
            <p className="text-muted-foreground">
              {tr('Đồ họa đã tự giảm vì máy chạy chậm. Bấm "Đồ họa: thấp" để bật lại mức cao.')}
            </p>
          )}
          {!fullscreen.supported && !installed && (
            <p className="text-muted-foreground">
              {tr(
                'Để ẩn thanh địa chỉ trên iPhone: bấm Chia sẻ rồi chọn "Thêm vào Màn hình chính" và mở game từ biểu tượng đó.',
              )}
            </p>
          )}
          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Scoreboard hud={hud} />
              <ItemBag hud={hud} game={game} columns={hud.itemSlots} />
              <StatsGrid hud={hud} className="rounded-md border border-border p-2" />
            </div>
            <div className="flex flex-col gap-2">
              {/* There is no hovering on a touch screen, so what each ability does is listed here. */}
              {hud.abilities.map((a) => (
                <div key={a.slot} className="rounded-md border border-border p-2">
                  <AbilityInfo ability={a} next={a.canLevelUp} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {shopOpen && <ShopPanel hud={hud} game={game} onClose={toggleShop} />}

      <AimCancel />

      <div className="absolute bottom-5 left-6">
        <Joystick onMove={walk} onRelease={halt} />
      </div>

      {/* There is no hovering on a touch screen: holding + shows what the next level brings. */}
      <AbilityCard hud={hud} hidden={preview !== undefined} />
      {preview && (
        <div className="pointer-events-auto absolute right-[16.5rem] bottom-24 z-20 flex max-h-[calc(100dvh-7rem)] w-64 flex-col gap-2 overflow-y-auto rounded-lg hud-sheet p-2 text-xs">
          <AbilityInfo ability={preview} next />
          <p className="text-[11px] text-muted-foreground">{tr('Chạm + để nâng ngay · giữ + để xem trước')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onPointerDown={() => {
                game.send({ t: 'levelUp', slot: preview.slot });
                setPreviewSlot(null);
              }}
              className="flex-1 touch-none rounded-md bg-primary px-3 py-2 font-bold text-primary-foreground"
            >
              {tr('Nâng cấp')}
            </button>
            <button
              type="button"
              onPointerDown={() => setPreviewSlot(null)}
              className="touch-none rounded-md border border-border px-3 py-2"
            >
              {tr('Đóng')}
            </button>
          </div>
        </div>
      )}

      <Vitals hud={hud} />
      <QuickBuy hud={hud} game={game} className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2" />
      <RecallNotice hud={hud} />

      <div className="absolute right-4 bottom-4 h-48 w-60">
        <button
          type="button"
          aria-label={tr('Tấn công kẻ địch gần nhất')}
          disabled={hud.dead}
          onPointerDown={() => attackNearest(game, ATTACK_SEARCH_RANGE)}
          className="pointer-events-auto absolute right-0 bottom-0 size-[88px] touch-none rounded-full border-2 border-enemy bg-enemy/25 text-sm font-bold disabled:opacity-40"
        >
          <GameIcon id="attack" className="mx-auto size-12" />
        </button>
        {hud.abilities.map((a) => (
          <RoundAbility key={a.slot} ability={a} game={game} onPreview={setPreviewSlot} />
        ))}
        {hud.spells.map((s) => (
          <RoundSpell key={s.id} spell={s} game={game} />
        ))}
      </div>
      <EndScreen hud={hud} actions={actions} />
    </div>
  );
}
