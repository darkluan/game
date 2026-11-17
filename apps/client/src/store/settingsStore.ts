import { create } from 'zustand';
import { setMuted } from '@/lib/audio';
import { cleanNickname } from '@game/core';
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
    };
  } catch {
    // Storage blocked or corrupted: use the defaults.
    return { graphics: 'high', muted: false, music: DEFAULT_THEME, nickname: '' };
  }
}

interface SettingsStore extends Saved {
  toggleGraphics: () => void;
  toggleMuted: () => void;
  setMusic: (music: ThemeId) => void;
  setNickname: (nickname: string) => void;
}

const initial = load();
setMuted(initial.muted);

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    const { graphics, muted, music, nickname } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ graphics, muted, music, nickname }));
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
  };
});
