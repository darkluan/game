import { create } from 'zustand';
import type { Vec2 } from '@game/core';

interface TutorialStore {
  /** Index of the tip being shown. */
  step: number;
  /** Where the hero stood when the tutorial began, to tell when the player has moved. */
  origin: Vec2 | null;
  begin: (origin: Vec2) => void;
  next: () => void;
}

/** How far the first-match tutorial has got. Starts again with every match it is shown in. */
export const useTutorialStore = create<TutorialStore>((set, get) => ({
  step: 0,
  origin: null,
  begin: (origin) => set({ step: 0, origin: { ...origin } }),
  next: () => set({ step: get().step + 1 }),
}));
