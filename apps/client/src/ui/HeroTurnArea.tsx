import { type ReactNode, useRef } from 'react';
import { tr } from '@/i18n';
import { useShowcaseStore } from '@/store/showcaseStore';

/** Radians the hero turns for each pixel dragged. */
const TURN_PER_PIXEL = 0.012;

/**
 * An area to press and drag on, left or right, to turn the 3D hero on show and look at it from
 * every side. The hero itself is drawn elsewhere (behind this area, or inside it as `children`).
 */
export function HeroTurnArea({ children, className = '' }: { children?: ReactNode; className?: string }) {
  const turnBy = useShowcaseStore((s) => s.turnBy);
  const lastX = useRef<number | null>(null);
  return (
    <div
      role="img"
      aria-label={tr('Giữ và kéo để xoay tướng')}
      title={tr('Giữ và kéo để xoay tướng')}
      onPointerDown={(event) => {
        lastX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (lastX.current === null) return;
        turnBy((event.clientX - lastX.current) * TURN_PER_PIXEL);
        lastX.current = event.clientX;
      }}
      onPointerUp={() => (lastX.current = null)}
      onPointerCancel={() => (lastX.current = null)}
      // touch-none: on a phone, dragging here turns the hero instead of scrolling the page.
      className={`cursor-grab touch-none select-none active:cursor-grabbing ${className}`}
    >
      {children}
    </div>
  );
}
