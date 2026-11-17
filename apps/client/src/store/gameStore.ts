import { create } from 'zustand';
import { playCue, unlockAudio } from '@/lib/audio';
import { LocalGame } from '@/lib/localGame';
import type { GameSession, HudState } from '@/lib/session';

interface GameStore {
  game: GameSession | null;
  hud: HudState | null;
  /** Must be called from a click, which also lets the browser start audio. */
  startOffline: () => void;
  quit: () => void;
  /** Show a match, or clear it with null. */
  setGame: (game: GameSession | null) => void;
  setHud: (hud: HudState) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  hud: null,
  startOffline: () => {
    unlockAudio();
    playCue('matchStart');
    const game = new LocalGame(Date.now(), playCue);
    set({ game, hud: game.hud() });
  },
  quit: () => set({ game: null, hud: null }),
  setGame: (game) => set({ game, hud: game ? game.hud() : null }),
  setHud: (hud) => set({ hud }),
}));
