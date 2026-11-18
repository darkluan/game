import { create } from 'zustand';
import { playCue, unlockAudio } from '@/lib/audio';
import { LocalGame } from '@/lib/localGame';
import type { GameSession, HudState } from '@/lib/session';
import type { Vec2 } from '@game/core';
import { useTutorialStore } from './tutorialStore';
import { useSettingsStore } from './settingsStore';

interface GameStore {
  game: GameSession | null;
  hud: HudState | null;
  shopOpen: boolean;
  scoreboardOpen: boolean;
  /** The quick-chat panel is open. */
  chatOpen: boolean;
  /** It was opened to type: the cursor starts in the text box, so the number keys write instead of sending phrases. */
  chatTyping: boolean;
  /** Desktop: the signal wheel is open at this point of the screen, for this point of the ground. */
  pingWheel: { x: number; y: number; at: Vec2 } | null;
  /** Must be called from a click, which also lets the browser start audio. */
  startOffline: () => void;
  quit: () => void;
  /** Show a match, or clear it with null. */
  setGame: (game: GameSession | null) => void;
  setHud: (hud: HudState) => void;
  toggleShop: () => void;
  setScoreboard: (open: boolean) => void;
  setChatOpen: (open: boolean, typing?: boolean) => void;
  setPingWheel: (wheel: { x: number; y: number; at: Vec2 } | null) => void;
  /** A point of the map the player is holding the minimap on: the camera looks there instead of at the hero. */
  peek: Vec2 | null;
  setPeek: (at: Vec2 | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  hud: null,
  shopOpen: false,
  scoreboardOpen: false,
  chatOpen: false,
  chatTyping: false,
  pingWheel: null,
  startOffline: () => {
    unlockAudio();
    playCue('matchStart');
    const game = new LocalGame(Date.now(), useSettingsStore.getState().heroId, playCue);
    useTutorialStore.getState().begin(game.hero.pos);
    get().setGame(game);
  },
  quit: () => get().setGame(null),
  setGame: (game) =>
    set({
      game,
      hud: game ? game.hud() : null,
      shopOpen: false,
      scoreboardOpen: false,
      chatOpen: false,
      pingWheel: null,
      peek: null,
    }),
  setHud: (hud) => set({ hud }),
  toggleShop: () => set({ shopOpen: !get().shopOpen }),
  setScoreboard: (scoreboardOpen) => set({ scoreboardOpen }),
  setChatOpen: (chatOpen, typing = false) => set({ chatOpen, chatTyping: chatOpen && typing }),
  setPingWheel: (pingWheel) => set({ pingWheel }),
  peek: null,
  setPeek: (peek) => set({ peek }),
}));
