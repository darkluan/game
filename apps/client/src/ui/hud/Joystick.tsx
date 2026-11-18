import { useEffect, useRef } from 'react';
import type { Vec2 } from '@game/core';

const SIZE = 132;
const KNOB = 56;
const REACH = (SIZE - KNOB) / 2;
/** Pushes smaller than this fraction of the reach are ignored, so a resting thumb does not walk the hero. */
const DEAD_ZONE = 0.2;
const SEND_EVERY_MS = 120;

/**
 * A virtual thumbstick. While it is pushed, `onMove` is called a few times a second with the
 * direction on the ground (x to the right of the screen, z toward the bottom); `onRelease` when let go.
 */
export function Joystick({ onMove, onRelease }: { onMove: (dir: Vec2) => void; onRelease: () => void }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const state = useRef({ pointer: -1, dir: null as Vec2 | null });

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (state.current.dir) onMove(state.current.dir);
    }, SEND_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [onMove]);

  const track = (e: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect || e.pointerId !== state.current.pointer) return;
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > REACH) {
      dx = (dx / length) * REACH;
      dy = (dy / length) * REACH;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const pushed = length / REACH >= DEAD_ZONE;
    const first = pushed && !state.current.dir;
    state.current.dir = pushed ? { x: dx / Math.max(length, 1e-6), z: dy / Math.max(length, 1e-6) } : null;
    // Respond at once to the first push rather than waiting for the next timer tick.
    if (first && state.current.dir) onMove(state.current.dir);
  };

  const release = (e: React.PointerEvent) => {
    if (e.pointerId !== state.current.pointer) return;
    const wasMoving = state.current.dir !== null;
    state.current = { pointer: -1, dir: null };
    if (knob.current) knob.current.style.transform = '';
    if (wasMoving) onRelease();
  };

  return (
    <div
      ref={base}
      role="application"
      aria-label="Cần điều khiển di chuyển"
      style={{ width: SIZE, height: SIZE }}
      className="pointer-events-auto flex touch-none items-center justify-center rounded-full border-2 border-border bg-panel/70"
      onPointerDown={(e) => {
        if (state.current.pointer !== -1) return;
        state.current.pointer = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        track(e);
      }}
      onPointerMove={track}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        ref={knob}
        style={{ width: KNOB, height: KNOB }}
        className="rounded-full border-2 border-primary bg-primary/30"
      />
    </div>
  );
}
