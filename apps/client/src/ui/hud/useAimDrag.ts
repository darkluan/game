import { useRef } from 'react';
import { type AbilitySlot, SPELLS, type Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';

/** A finger must travel this far from where it came down before it counts as aiming and not as a tap. */
const DEADZONE_PX = 14;
/** Dragged this far, a point ability lands at its full reach. */
const FULL_REACH_PX = 78;
/** The id of the spot a drag can be carried to in order to call the cast off. */
export const AIM_CANCEL_ID = 'aim-cancel';

const within = (el: Element | null, x: number, y: number): boolean => {
  const box = el?.getBoundingClientRect();
  return box !== undefined && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
};

/**
 * Makes a button aim what it casts, the way phone games of this kind do: put a finger down and the
 * scene shows where the cast would land; drag, and it is aimed where the finger points, the way
 * and how far; lift, and it is cast there. A tap with no drag is cast as before, at the nearest
 * enemy. A drag carried onto the cancel spot and lifted there casts nothing.
 *
 * The drag is read like the joystick: right on the screen is +x on the ground, down is +z.
 * `cast` receives the point aimed at, or null for a tap.
 */
export function useAimDrag(game: GameSession, what: AbilitySlot | 'flash', cast: (aim: Vec2 | null) => void) {
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const end = () => {
    drag.current = null;
    useGameStore.getState().setAim(null);
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const box = e.currentTarget.getBoundingClientRect();
      drag.current = { pointer: e.pointerId, x: box.left + box.width / 2, y: box.top + box.height / 2 };
      useGameStore.getState().setAim(what);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const from = drag.current;
      if (!from || e.pointerId !== from.pointer) return;
      const [dx, dy] = [e.clientX - from.x, e.clientY - from.y];
      const far = Math.hypot(dx, dy);
      const store = useGameStore.getState();
      if (far < DEADZONE_PX) {
        store.setAim(what);
        return;
      }
      const def = what === 'flash' ? null : game.ability(what);
      const range = def ? def.range : SPELLS.flash.range;
      // A shot down a line always goes its whole length; anything else lands as far out as the finger has gone.
      const whole = def?.targeting === 'direction';
      const reach = whole ? 1 : Math.max(0.15, Math.min(1, (far - DEADZONE_PX) / (FULL_REACH_PX - DEADZONE_PX)));
      const offset = { x: (dx / far) * range * reach, z: (dy / far) * range * reach };
      store.setAim(what, offset, within(document.getElementById(AIM_CANCEL_ID), e.clientX, e.clientY));
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!drag.current || e.pointerId !== drag.current.pointer) return;
      const { aimOffset, aimCancel } = useGameStore.getState();
      end();
      if (aimCancel) return;
      if (!aimOffset) return cast(null);
      const hero = game.renderPos(game.hero, { x: 0, z: 0 });
      cast({ x: hero.x + aimOffset.x, z: hero.z + aimOffset.z });
    },
    onPointerCancel: end,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}
