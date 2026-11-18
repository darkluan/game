import { tr } from '@/i18n';
import { PING_TYPES, type PingType } from '@game/core';
import { PING_ICON, PING_TEXT } from '@/lib/chatText';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { WHEEL_ANGLE, WHEEL_RADIUS } from '@/lib/pingWheel';
import { GameIcon } from '../icons/GameIcon';
import { minimapPoint } from '@/lib/minimapPoint';

const TONE: Record<PingType, string> = {
  attack: 'border-enemy text-enemy',
  retreat: 'border-gold text-gold',
  gather: 'border-ally text-ally',
};

/**
 * Phone: the three signals as buttons beside the minimap. A tap signals where the hero stands;
 * dragging a button onto the minimap and letting go signals that spot instead.
 */
export function PingButtons({ game, className }: { game: GameSession; className: string }) {
  if (!game.chatEnabled) return null;
  return (
    <div className={`pointer-events-auto absolute flex gap-1.5 ${className}`}>
      {PING_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          aria-label={PING_TEXT[type]}
          // Keeps the finger's release coming here even when it has slid off the button.
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerUp={(e) => {
            const map = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-minimap]');
            const at = map ? minimapPoint(map, e.clientX, e.clientY, game.map) : game.hero.pos;
            game.sendChat({ k: 'ping', type, x: at.x, z: at.z });
          }}
          className={`size-8 touch-none rounded-full border-2 bg-background/85 p-1.5 ${TONE[type]}`}
        >
          <GameIcon id={PING_ICON[type]} className="size-full" />
        </button>
      ))}
    </div>
  );
}

/**
 * Mouse: holding Alt and pressing on the ground opens this wheel under the cursor; letting go over
 * a signal sends it for that spot, and letting go in the middle calls the team there.
 */
export function PingWheel() {
  const wheel = useGameStore((s) => s.pingWheel);
  if (!wheel) return null;
  return (
    <div className="pointer-events-none fixed z-30" style={{ left: wheel.x, top: wheel.y }}>
      <span className="absolute size-3 -translate-1/2 rounded-full bg-foreground/80" />
      {PING_TYPES.map((type) => {
        const angle = (WHEEL_ANGLE[type] * Math.PI) / 180;
        return (
          <span
            key={type}
            style={{ left: Math.cos(angle) * WHEEL_RADIUS, top: Math.sin(angle) * WHEEL_RADIUS }}
            className={`absolute flex -translate-1/2 items-center gap-1 rounded-full border-2 bg-background/90 px-2 py-1 text-xs font-semibold whitespace-nowrap ${TONE[type]}`}
          >
            <GameIcon id={PING_ICON[type]} className="size-4" />
            {PING_TEXT[type]}
          </span>
        );
      })}
      <span className="absolute top-24 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted-foreground">
        {tr('Thả chuột trên tín hiệu muốn gửi')}
      </span>
    </div>
  );
}
