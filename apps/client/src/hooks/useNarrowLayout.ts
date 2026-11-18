import { useSyncExternalStore } from 'react';

/** Below Tailwind's `sm` breakpoint: a phone held upright. */
const QUERY = '(max-width: 40rem)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** True on a screen too narrow for side-by-side columns. */
export function useNarrowLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
