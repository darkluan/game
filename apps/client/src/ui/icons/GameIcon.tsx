import { GAME_ICONS } from './gameIcons';

/**
 * An icon for an ability, an item or a HUD action, drawn in the current text colour.
 * Renders nothing for an id without an icon, so callers can keep a text fallback beside it.
 */
export function GameIcon({ id, className }: { id: string; className?: string }) {
  const icon = GAME_ICONS[id];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <path fill="currentColor" d={icon.d} />
    </svg>
  );
}
