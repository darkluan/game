import { create } from 'zustand';
import { setMuted } from '@/lib/audio';
import { cleanNickname, HERO_IDS } from '@game/core';
import { DEFAULT_THEME, THEME_IDS, type ThemeId } from '@/lib/music';

export type Graphics = 'high' | 'low';

const STORAGE_KEY = 'tu-toc-settings';

interface Saved {
  graphics: Graphics;
  muted: boolean;
  /** Which lobby theme plays on the menu. */
  music: ThemeId;
  /** Name shown to other players. */
  nickname: string;
  /** Hero played against bots, and the first pick offered in a room. */
  heroId: string;
}

function load(): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const saved = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Saved>;
    return {
      graphics: saved.graphics === 'low' ? 'low' : 'high',
      muted: saved.muted === true,
      music: THEME_IDS.find((id) => id === saved.music) ?? DEFAULT_THEME,
      nickname: cleanNickname(saved.nickname),
      heroId: HERO_IDS.find((id) => id === saved.heroId) ?? HERO_IDS[0],
    };
  } catch {
    // Storage blocked or corrupted: use the defaults.
    return { graphics: 'high', muted: false, music: DEFAULT_THEME, nickname: '', heroId: HERO_IDS[0] };
  }
}

interface SettingsStore extends Saved {
  toggleGraphics: () => void;
  toggleMuted: () => void;
  setMusic: (music: ThemeId) => void;
  setNickname: (nickname: string) => void;
  setHeroId: (heroId: string) => void;
}

const initial = load();
setMuted(initial.muted);

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    const { graphics, muted, music, nickname, heroId } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ graphics, muted, music, nickname, heroId }));
    } catch {
      // Storage blocked: the choice just lasts for this visit.
    }
  };
  return {
    ...initial,
    toggleGraphics: () => update({ graphics: get().graphics === 'high' ? 'low' : 'high' }),
    toggleMuted: () => {
      update({ muted: !get().muted });
      setMuted(get().muted);
    },
    setMusic: (music) => update({ music }),
    setNickname: (nickname) => update({ nickname: cleanNickname(nickname) }),
    setHeroId: (heroId) => {
      if (HERO_IDS.includes(heroId)) update({ heroId });
    },
  };
});
