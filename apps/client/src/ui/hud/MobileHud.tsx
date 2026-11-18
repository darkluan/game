import { tr } from '@/i18n';
import { useCallback, useState } from 'react';
import { ITEMS, type Vec2 } from '@game/core';
import { attackNearest, castSlot, moveInDirection } from '@/input/commands';
import type { AbilityHud, GameSession, HudState } from '@/lib/session';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useGameStore } from '@/store/gameStore';
import { launchedAsApp } from '@/lib/install';
import { useSettingsStore } from '@/store/settingsStore';
import { HeroPortrait } from '../HeroPortrait';
import { Minimap } from '../Minimap';
import { GameIcon } from '../icons/GameIcon';
import { ItemBag, ShopPanel } from '../Shop';
import {
  AbilityInfo,
  DeathNotice,
  EndScreen,
  EventFeed,
  type LayoutProps,
  Scoreboard,
  StatsGrid,
  TeamBar,
} from './parts';
import { Joystick } from './Joystick';

/** How far the attack button looks for a target. */
const ATTACK_SEARCH_RANGE = 12;

/** Where each ability sits around the attack button: offsets from the bottom-right corner, in pixels. */
const ABILITY_SPOTS: Record<string, { right: number; bottom: number; size: number }> = {
  Q: { right: 108, bottom: 4, size: 58 },
  W: { right: 92, bottom: 74, size: 58 },
  E: { right: 22, bottom: 110, size: 58 },
  R: { right: 168, bottom: 62, size: 66 },
};

function RoundAbility({ ability, game }: { ability: AbilityHud; game: GameSession }) {
  const spot = ABILITY_SPOTS[ability.slot];
  const cooling = ability.level > 0 && ability.cooldownLeft > 0;
  return (
    <div className="absolute" style={{ right: spot.right, bottom: spot.bottom, width: spot.size, height: spot.size }}>
      <button
        type="button"
        aria-label={ability.name}
        disabled={!ability.usable}
        // pointerdown, not click: on a phone a click waits for the finger to lift.
        onPointerDown={() => castSlot(game, ability.slot, null)}
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
          onPointerDown={() => game.send({ t: 'levelUp', slot: ability.slot })}
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
                {item && <GameIcon id={item.id} className="size-5" />}
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
  const fullscreen = useFullscreen();
  // An installed app already fills the screen and is already sideways.
  const installed = launchedAsApp;
  const offerFullscreen = fullscreen.supported && !fullscreen.active && !installed;
  const walk = useCallback((dir: Vec2) => moveInDirection(game, dir), [game]);
  const halt = useCallback(() => game.send({ t: 'stop' }), [game]);
  const chip = 'pointer-events-auto touch-none rounded-md hud-panel px-2.5 py-1.5 text-xs';
  const option = 'rounded-md border border-border px-3 py-2';

  return (
    // Kept clear of the notch and the rounded corners of a phone held sideways.
    <div className="pointer-events-none absolute top-[env(safe-area-inset-top)] right-[env(safe-area-inset-right)] bottom-[env(safe-area-inset-bottom)] left-[env(safe-area-inset-left)] text-foreground select-none">
      <div className="absolute top-1 left-1 origin-top-left scale-[0.62]">
        <Minimap game={game} />
      </div>

      <TeamBar hud={hud} compact />
      <EventFeed hud={hud} className="top-12 text-[11px]" />

      <div className="absolute top-1 right-1 flex items-center gap-1.5">
        <span className="rounded-md hud-panel px-2.5 py-1.5 text-xs font-semibold text-gold tabular-nums">
          {Math.floor(hud.gold)}
        </span>
        <button
          type="button"
          onPointerDown={toggleShop}
          aria-pressed={shopOpen}
          className={`${chip} ${hud.canShop ? 'border-primary text-primary' : ''}`}
        >
          {tr('Cửa hàng')}
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

      <div className="absolute bottom-5 left-6">
        <Joystick onMove={walk} onRelease={halt} />
      </div>

      <Vitals hud={hud} />

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
          <RoundAbility key={a.slot} ability={a} game={game} />
        ))}
      </div>

      {/* The game is laid out for a phone held sideways. */}
      <div className="pointer-events-auto absolute inset-0 hidden flex-col items-center justify-center gap-4 bg-background/90 p-6 text-center text-lg font-semibold portrait:flex">
        {tr('Hãy xoay ngang điện thoại để chơi.')}
        {fullscreen.supported && !installed && (
          <button type="button" onClick={() => void fullscreen.enter()} className="btn btn-primary cut-corners text-sm">
            {tr('Xoay ngang và toàn màn hình')}
          </button>
        )}
      </div>

      <DeathNotice hud={hud} />
      <EndScreen hud={hud} actions={actions} />
    </div>
  );
}
