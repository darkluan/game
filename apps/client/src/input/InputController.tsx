import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ABILITY_SLOTS, type AbilitySlot } from '@game/core';
import type { GameSession } from '@/lib/session';
import { castSlot, clickGround } from './commands';

/** Mouse: click to move or attack. Keys: Q W E R cast at the cursor, Alt+key levels up, S stops. */
export function InputController({ game }: { game: GameSession }) {
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) clickGround(game, game.cursor);
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      // e.code is layout-independent and unaffected by Alt producing other characters.
      const key = e.code.replace('Key', '');
      if ((ABILITY_SLOTS as readonly string[]).includes(key)) {
        e.preventDefault();
        if (e.altKey) game.send({ t: 'levelUp', slot: key as AbilitySlot });
        else castSlot(game, key as AbilitySlot, game.cursor);
      } else if (key === 'S') {
        game.send({ t: 'stop' });
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canvas, game]);

  return null;
}
