import { PING_TYPES, type PingType } from '@game/core';

/** How far from where the button went down the pointer must travel to pick a signal off the wheel. */
const WHEEL_DEADZONE = 28;
/** Where each signal sits round the wheel, in degrees (0 = right, 90 = down). */
export const WHEEL_ANGLE: Record<PingType, number> = { attack: -90, retreat: 150, gather: 30 };
/** How far from its centre the wheel draws them, in pixels. */
export const WHEEL_RADIUS = 62;

/** The signal chosen by letting go at this offset from the wheel's centre; the middle means "gather". */
export function pingAtOffset(dx: number, dy: number): PingType {
  if (Math.hypot(dx, dy) < WHEEL_DEADZONE) return 'gather';
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const apart = (a: number) => Math.abs(((angle - a + 540) % 360) - 180);
  return PING_TYPES.reduce((best, type) => (apart(WHEEL_ANGLE[type]) < apart(WHEEL_ANGLE[best]) ? type : best));
}
