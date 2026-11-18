import { useCallback, useState } from 'react';
import type { Vec2 } from '@game/core';
import { attackNearest, castSlot, moveInDirection } from '@/input/commands';
import type { AbilityHud, GameSession, HudState } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Minimap } from '../Minimap';
import { ItemBag, ShopPanel } from '../Shop';
import { clock, teamKills } from './format';
import { DeathNotice, EndScreen, EventFeed, type LayoutProps, Scoreboard } from './parts';
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
          ability.usable ? 'border-primary' : 'border-border text-muted-foreground'
        }`}
      >
        {cooling && (
          <span
            className="absolute inset-x-0 bottom-0 bg-foreground/25"
            style={{ height: `${ability.cooldownFraction * 100}%` }}
          />
        )}
        <span className="relative block px-1 text-[10px] leading-tight break-words whitespace-normal">
          {cooling ? Math.ceil(ability.cooldownLeft) : ability.name}
        </span>
      </button>
      {ability.canLevelUp && (
        <button
          type="button"
          aria-label={`Nâng cấp ${ability.name}`}
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
    <div className="absolute bottom-2 left-1/2 flex w-[34vw] -translate-x-1/2 flex-col gap-1">
      <div className="flex justify-between text-[11px] font-semibold tabular-nums">
        <span>
          Cấp {hud.level}
          {hud.resource === 'none' && <span className="text-race-dragon"> · Tiến hóa {hud.stage}/2</span>}
          {hud.overloadSeconds > 0 && <span className="text-danger"> · QUÁ TẢI</span>}
        </span>
        <span>
          {Math.ceil(hud.hp)} / {hud.maxHp}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-sm border border-border bg-background"
        role="progressbar"
        aria-label="Máu"
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
      {hud.conditions.length > 0 && <p className="text-center text-[11px] text-danger">{hud.conditions.join(' · ')}</p>}
    </div>
  );
}

/**
 * Touch layout: a thumbstick bottom left to walk, an attack button with the four abilities around it
 * bottom right, and only the essentials elsewhere. Abilities aim themselves at the nearest enemy.
 */
export function MobileHud({ game, hud, actions }: LayoutProps) {
  const { graphics, muted, toggleGraphics, toggleMuted } = useSettingsStore();
  const shopOpen = useGameStore((s) => s.shopOpen);
  const toggleShop = useGameStore((s) => s.toggleShop);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mine, theirs] = teamKills(hud);
  const walk = useCallback((dir: Vec2) => moveInDirection(game, dir), [game]);
  const halt = useCallback(() => game.send({ t: 'stop' }), [game]);
  const chip = 'pointer-events-auto touch-none rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs';

  return (
    <div className="pointer-events-none absolute inset-0 text-foreground select-none">
      <div className="absolute top-1 left-1 origin-top-left scale-[0.62]">
        <Minimap game={game} />
      </div>

      <div className="absolute top-1 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border border-border bg-panel px-3 py-0.5 text-sm font-bold tabular-nums">
        <span className="text-ally">{mine}</span>
        <span>{clock(hud.timeSeconds)}</span>
        <span className="text-enemy">{theirs}</span>
      </div>
      <EventFeed hud={hud} className="top-9 text-[11px]" />

      <div className="absolute top-1 right-1 flex items-center gap-1.5">
        <span className="rounded-md border border-border bg-panel px-2.5 py-1.5 text-xs font-semibold text-gold tabular-nums">
          {Math.floor(hud.gold)}
        </span>
        <button
          type="button"
          onPointerDown={toggleShop}
          aria-pressed={shopOpen}
          className={`${chip} ${hud.canShop ? 'border-primary text-primary' : ''}`}
        >
          Cửa hàng
        </button>
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
        <div className="pointer-events-auto absolute top-11 right-1 flex max-h-[80vh] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-panel p-2 text-xs">
          <Scoreboard hud={hud} />
          <ItemBag hud={hud} game={game} columns={hud.itemSlots} />
          <button type="button" onClick={toggleMuted} className="rounded-md border border-border px-3 py-2">
            Âm thanh: {muted ? 'tắt' : 'bật'}
          </button>
          <button type="button" onClick={toggleGraphics} className="rounded-md border border-border px-3 py-2">
            Đồ họa: {graphics === 'high' ? 'cao' : 'thấp'}
          </button>
          <button
            type="button"
            onClick={actions.exit}
            className="rounded-md border border-border px-3 py-2 text-danger"
          >
            Thoát trận
          </button>
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
          aria-label="Tấn công kẻ địch gần nhất"
          disabled={hud.dead}
          onPointerDown={() => attackNearest(game, ATTACK_SEARCH_RANGE)}
          className="pointer-events-auto absolute right-0 bottom-0 size-[88px] touch-none rounded-full border-2 border-enemy bg-enemy/25 text-sm font-bold disabled:opacity-40"
        >
          Đánh
        </button>
        {hud.abilities.map((a) => (
          <RoundAbility key={a.slot} ability={a} game={game} />
        ))}
      </div>

      {/* The game is laid out for a phone held sideways. */}
      <div className="pointer-events-auto absolute inset-0 hidden items-center justify-center bg-background/90 p-6 text-center text-lg font-semibold portrait:flex">
        Hãy xoay ngang điện thoại để chơi.
      </div>

      <DeathNotice hud={hud} />
      <EndScreen hud={hud} actions={actions} />
    </div>
  );
}
