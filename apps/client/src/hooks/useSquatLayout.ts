import { useSyncExternalStore } from 'react';

/** The same test as the `squat` style variant: a phone held sideways, wide but very short. */
const QUERY = '(orientation: landscape) and (max-height: 520px)';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** True on a phone held sideways, where the lobby is laid out in three narrow columns round the hero. */
export function useSquatLayout(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
