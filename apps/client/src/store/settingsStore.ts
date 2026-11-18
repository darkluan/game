import { create } from 'zustand';
import { type Lang, lang, SETTINGS_KEY } from '@/i18n';
import { setMuted } from '@/lib/audio';
import { cleanNickname, HERO_IDS } from '@game/core';
import { DEFAULT_THEME, THEME_IDS, type ThemeId } from '@/lib/music';

export type Graphics = 'high' | 'low';

const STORAGE_KEY = SETTINGS_KEY;

interface Saved {
  graphics: Graphics;
  muted: boolean;
  /** Which lobby theme plays on the menu. */
  music: ThemeId;
  /** Play the theme on the home screen too. Off by default: there the music waits to be asked for. */
  homeMusic: boolean;
  /** Name shown to other players. */
  nickname: string;
  /** Hero played against bots, and the first pick offered in a room. */
  heroId: string;
  /** Team chat and map marks from other players are hidden. */
  chatOff: boolean;
  /** The first-match tutorial has been finished or skipped. */
  tutorialDone: boolean;
  /** The language the game is shown in. */
  lang: Lang;
}

function load(): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const saved = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Saved>;
    return {
      graphics: saved.graphics === 'low' ? 'low' : 'high',
      muted: saved.muted === true,
      music: THEME_IDS.find((id) => id === saved.music) ?? DEFAULT_THEME,
      homeMusic: saved.homeMusic === true,
      chatOff: saved.chatOff === true,
      nickname: cleanNickname(saved.nickname),
      heroId: HERO_IDS.find((id) => id === saved.heroId) ?? HERO_IDS[0],
      tutorialDone: saved.tutorialDone === true,
      lang,
    };
  } catch {
    // Storage blocked or corrupted: use the defaults.
    return {
      graphics: 'high',
      muted: false,
      music: DEFAULT_THEME,
      homeMusic: false,
      chatOff: false,
      nickname: '',
      heroId: HERO_IDS[0],
      tutorialDone: false,
      lang,
    };
  }
}

interface SettingsStore extends Saved {
  toggleGraphics: () => void;
  /** True after the game lowered the graphics by itself because frames were slow. */
  autoLowered: boolean;
  /**
   * Switch to low graphics once, for a machine that cannot keep up. A later manual choice wins.
   * It lasts for this visit only: one bad moment must not leave the game looking poor for good.
   */
  lowerGraphics: () => void;
  toggleMuted: () => void;
  setMusic: (music: ThemeId) => void;
  toggleHomeMusic: () => void;
  toggleChat: () => void;
  setNickname: (nickname: string) => void;
  setHeroId: (heroId: string) => void;
  finishTutorial: () => void;
  /** Saves the choice and reloads the page, which is when the language is read. */
  setLang: (lang: Lang) => void;
}

const initial = load();
setMuted(initial.muted);

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const update = (change: Partial<Saved>) => {
    set(change);
    const { graphics, muted, music, homeMusic, chatOff, nickname, heroId, tutorialDone, lang } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ graphics, muted, music, homeMusic, chatOff, nickname, heroId, tutorialDone, lang }),
      );
    } catch {
      // Storage blocked: the choice just lasts for this visit.
    }
  };
  return {
    ...initial,
    toggleGraphics: () => update({ graphics: get().graphics === 'high' ? 'low' : 'high' }),
    autoLowered: false,
    lowerGraphics: () => {
      if (get().graphics !== 'high' || get().autoLowered) return;
      set({ graphics: 'low', autoLowered: true });
    },
    toggleMuted: () => {
      update({ muted: !get().muted });
      setMuted(get().muted);
    },
    setMusic: (music) => update({ music }),
    toggleHomeMusic: () => update({ homeMusic: !get().homeMusic }),
    toggleChat: () => update({ chatOff: !get().chatOff }),
    setNickname: (nickname) => update({ nickname: cleanNickname(nickname) }),
    setHeroId: (heroId) => {
      if (HERO_IDS.includes(heroId)) update({ heroId });
    },
    finishTutorial: () => update({ tutorialDone: true }),
    setLang: (next) => {
      if (next === get().lang) return;
      update({ lang: next });
      window.location.reload();
    },
  };
});
