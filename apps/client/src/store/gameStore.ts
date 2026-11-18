import { create } from 'zustand';
import { playCue, unlockAudio } from '@/lib/audio';
import { LocalGame } from '@/lib/localGame';
import type { GameSession, HudState } from '@/lib/session';
import { useTutorialStore } from './tutorialStore';
import { useSettingsStore } from './settingsStore';

interface GameStore {
  game: GameSession | null;
  hud: HudState | null;
  shopOpen: boolean;
  scoreboardOpen: boolean;
  /** Must be called from a click, which also lets the browser start audio. */
  startOffline: () => void;
  quit: () => void;
  /** Show a match, or clear it with null. */
  setGame: (game: GameSession | null) => void;
  setHud: (hud: HudState) => void;
  toggleShop: () => void;
  setScoreboard: (open: boolean) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  hud: null,
  shopOpen: false,
  scoreboardOpen: false,
  startOffline: () => {
    unlockAudio();
    playCue('matchStart');
    const game = new LocalGame(Date.now(), useSettingsStore.getState().heroId, playCue);
    useTutorialStore.getState().begin(game.hero.pos);
    get().setGame(game);
  },
  quit: () => get().setGame(null),
  setGame: (game) => set({ game, hud: game ? game.hud() : null, shopOpen: false, scoreboardOpen: false }),
  setHud: (hud) => set({ hud }),
  toggleShop: () => set({ shopOpen: !get().shopOpen }),
  setScoreboard: (scoreboardOpen) => set({ scoreboardOpen }),
}));
