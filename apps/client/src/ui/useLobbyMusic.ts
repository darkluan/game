import { useEffect } from 'react';
import { unlockAudio } from '@/lib/audio';
import { startMusic, stopMusic } from '@/lib/music';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Plays the chosen lobby theme while the calling screen is shown. A room or a queue passes
 * `always`; the home screen does not, and there the music plays only once the player has turned it on.
 */
export function useLobbyMusic(always = false): void {
  const theme = useSettingsStore((s) => s.music);
  const wanted = useSettingsStore((s) => s.homeMusic) || always;
  useEffect(() => {
    if (!wanted) return;
    // Browsers block audio until the first click or key press, so that is when the music can begin.
    const begin = () => {
      unlockAudio();
      startMusic(theme);
    };
    // Coming back from a match, or switching theme, audio is already unlocked: start right away.
    startMusic(theme);
    window.addEventListener('pointerdown', begin);
    window.addEventListener('keydown', begin);
    return () => {
      window.removeEventListener('pointerdown', begin);
      window.removeEventListener('keydown', begin);
      stopMusic();
    };
  }, [theme, wanted]);
}
