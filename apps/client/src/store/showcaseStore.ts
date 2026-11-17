import { create } from 'zustand';
import type { ActorAction } from '@/lib/session';

interface ShowcaseStore {
  /** The move last asked for; `n` goes up on every request so the same move can be asked for twice. */
  request: { kind: ActorAction['kind']; n: number };
  /** Have the hero on show in the lobby perform a move. */
  play: (kind: ActorAction['kind']) => void;
}

export const useShowcaseStore = create<ShowcaseStore>((set, get) => ({
  request: { kind: 'R', n: 0 },
  play: (kind) => set({ request: { kind, n: get().request.n + 1 } }),
}));
