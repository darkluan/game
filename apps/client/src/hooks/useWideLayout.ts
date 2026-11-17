import { useSyncExternalStore } from 'react';

/** Matches Tailwind's `xl` breakpoint: from here up the lobby has room for three columns. */
const QUERY = '(min-width: 80rem)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** True when the screen is wide enough to show the hero in the backdrop, between the two columns. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
