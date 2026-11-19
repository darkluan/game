import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { ABILITY_SLOTS, type AbilitySlot, MATCH_CHAT_IDS } from '@game/core';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { attackMove, castSlot, castSpell, clickGround } from './commands';
import { pingAtOffset } from '@/lib/pingWheel';

/** How far one unit of the wheel's turning slides the view, in units of ground: about three for a notch. */
const WHEEL_STEP = 0.03;
/** How fast an arrow key slides it, in units of ground a second. */
const ARROW_SPEED = 34;

/** A point for the view to look at, kept inside the map. */
function onMap(game: GameSession, x: number, z: number): { x: number; z: number } {
  const { halfWidth, halfDepth } = game.map;
  return { x: Math.max(-halfWidth, Math.min(halfWidth, x)), z: Math.max(-halfDepth, Math.min(halfDepth, z)) };
}

/**
 * Mouse and keyboard. Click to move or attack; Q W E R cast at the cursor; Alt+key levels up;
 * D heals, F flashes toward the cursor and T recalls to the fountain;
 * C opens the team's phrases, where 1 to 8 send one, and Enter opens the same panel ready to type; Alt + press opens the signal wheel;
 * S stops; B opens the shop; holding Tab shows the scoreboard.
 * While the hero is dead the mouse wheel and the arrow keys slide the view over the map, to watch
 * the fight go on.
 * With `touch`, moving is the joystick's job, so a tap on the ground only picks an enemy to attack.
 */
export function InputController({ game, touch }: { game: GameSession; touch: boolean }) {
  const canvas = useThree((s) => s.gl.domElement);
  /** Whether the hero was dead a frame ago, and which arrow keys are down: for looking round while it is. */
  const watch = useRef({ wasDead: false, keys: new Set<string>() });

  useFrame((_, delta) => {
    const state = watch.current;
    const dead = game.hero.dead === true;
    const store = useGameStore.getState();
    // Up again: whatever the view was moved to while dead, it goes back to the hero.
    if (state.wasDead && !dead) store.setPeek(null);
    state.wasDead = dead;
    if (!dead || state.keys.size === 0) return;
    const from = store.peek ?? game.renderPos(game.hero, { x: 0, z: 0 });
    const step = ARROW_SPEED * Math.min(0.1, delta);
    const dx = (state.keys.has('ArrowRight') ? 1 : 0) - (state.keys.has('ArrowLeft') ? 1 : 0);
    const dz = (state.keys.has('ArrowDown') ? 1 : 0) - (state.keys.has('ArrowUp') ? 1 : 0);
    store.setPeek(onMap(game, from.x + dx * step, from.z + dz * step));
  });

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
    const onWheel = (e: WheelEvent) => {
      // Only a dead hero's player has nothing better to do with the wheel than look around. A list
      // that scrolls (the shop, the chat) keeps the wheel for itself.
      if (touch || !game.hero.dead) return;
      if (e.target instanceof Element && e.target.closest('.overflow-y-auto')) return;
      e.preventDefault();
      const store = useGameStore.getState();
      const from = store.peek ?? game.renderPos(game.hero, { x: 0, z: 0 });
      // The wheel runs the length of the lane; tilted, or with Shift held, it goes across it.
      const across = e.shiftKey ? e.deltaY : e.deltaX;
      const along = e.shiftKey ? 0 : e.deltaY;
      store.setPeek(onMap(game, from.x + along * WHEEL_STEP, from.z + across * WHEEL_STEP));
    };
    const onContextMenu = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code.startsWith('Arrow')) watch.current.keys.add(e.code);
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
      watch.current.keys.delete(e.code);
      if (e.code === 'Tab') useGameStore.getState().setScoreboard(false);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    // On the window, not the game's canvas: the pointer is as likely to be over the HUD. Not passive:
    // the page must not scroll or zoom under the game.
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canvas, game, touch]);

  return null;
}
