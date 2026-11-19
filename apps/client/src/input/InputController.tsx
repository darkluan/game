import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { ABILITY_SLOTS, type AbilitySlot, MATCH_CHAT_IDS } from '@game/core';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { attackMove, castSlot, castSpell, clickGround } from './commands';
import { pingAtOffset } from '@/lib/pingWheel';

/**
 * Mouse and keyboard. Click to move or attack; Q W E R cast at the cursor; Alt+key levels up;
 * D heals, F flashes toward the cursor and T recalls to the fountain;
 * C opens the team's phrases, where 1 to 8 send one, and Enter opens the same panel ready to type; Alt + press opens the signal wheel;
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
      } else if (e.altKey && game.chatEnabled) {
        // Alt + press: open the signal wheel for this spot; the release picks the signal.
        useGameStore.getState().setPingWheel({ x: e.clientX, y: e.clientY, at: { ...game.cursor } });
      } else if (e.button === 0 || e.button === 2) {
        clickGround(game, game.cursor);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const { pingWheel, setPingWheel } = useGameStore.getState();
      if (!pingWheel) return;
      setPingWheel(null);
      const type = pingAtOffset(e.clientX - pingWheel.x, e.clientY - pingWheel.y);
      game.sendChat({ k: 'ping', type, x: pingWheel.at.x, z: pingWheel.at.z });
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        useGameStore.getState().setScoreboard(true);
        return;
      }
      // Typing into a box (the chat) is not playing.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      // e.code is layout-independent and unaffected by Alt producing other characters.
      const key = e.code.replace('Key', '');
      const store = useGameStore.getState();
      if (game.chatEnabled && (key === 'C' || e.code === 'Enter')) {
        // The key that opens the box must not land in it as its first letter.
        e.preventDefault();
        // Enter is for typing: the cursor goes into the box. C is for the phrases: 1 to 8 send one.
        store.setChatOpen(!store.chatOpen, e.code === 'Enter');
        return;
      }
      const phrase = store.chatOpen ? MATCH_CHAT_IDS[Number(e.code.replace('Digit', '')) - 1] : undefined;
      if (phrase) {
        game.sendChat({ k: 'quick', id: phrase });
        store.setChatOpen(false);
        return;
      }
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
      } else if (key === 'A') {
        attackMove(game, game.cursor);
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
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canvas, game, touch]);

  return null;
}
