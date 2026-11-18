import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ABILITY_SLOTS, type AbilitySlot } from '@game/core';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { castSlot, castSpell, clickGround } from './commands';

/**
 * Mouse and keyboard. Click to move or attack; Q W E R cast at the cursor; Alt+key levels up;
 * D heals, F flashes toward the cursor and T recalls to the fountain;
 * S stops; B opens the shop; holding Tab shows the scoreboard.
 * With `touch`, moving is the joystick's job, so a tap on the ground only picks an enemy to attack.
 */
export function InputController({ game, touch }: { game: GameSession; touch: boolean }) {
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (touch) {
        const enemy = game.pickEnemy(game.cursor, 1.5);
        if (enemy) game.send({ t: 'attack', targetId: enemy.id });
      } else if (e.button === 0 || e.button === 2) {
        clickGround(game, game.cursor);
      }
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        useGameStore.getState().setScoreboard(true);
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      // e.code is layout-independent and unaffected by Alt producing other characters.
      const key = e.code.replace('Key', '');
      if ((ABILITY_SLOTS as readonly string[]).includes(key)) {
        e.preventDefault();
        if (e.altKey) game.send({ t: 'levelUp', slot: key as AbilitySlot });
        else castSlot(game, key as AbilitySlot, game.cursor);
      } else if (key === 'D') {
        castSpell(game, 'heal', null);
      } else if (key === 'F') {
        castSpell(game, 'flash', game.cursor);
      } else if (key === 'T') {
        castSpell(game, 'recall', null);
      } else if (key === 'S') {
        game.send({ t: 'stop' });
      } else if (key === 'B') {
        useGameStore.getState().toggleShop();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') useGameStore.getState().setScoreboard(false);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canvas, game, touch]);

  return null;
}
