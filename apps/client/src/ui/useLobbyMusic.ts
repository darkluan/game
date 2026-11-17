import { useEffect } from 'react';
import { unlockAudio } from '@/lib/audio';
import { startMusic, stopMusic } from '@/lib/music';
import { useSettingsStore } from '@/store/settingsStore';

/** Plays the chosen lobby theme while the calling screen is shown. */
export function useLobbyMusic(): void {
  const theme = useSettingsStore((s) => s.music);
  useEffect(() => {
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
  }, [theme]);
}
