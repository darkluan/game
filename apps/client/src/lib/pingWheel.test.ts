import { describe, expect, it } from 'vitest';
import { pingAtOffset } from './pingWheel';

describe('pingAtOffset', () => {
  it('calls the team to the spot when the button is let go where it went down', () => {
    expect(pingAtOffset(0, 0)).toBe('gather');
    expect(pingAtOffset(-10, 12)).toBe('gather');
  });

  it('picks the signal the pointer was dragged toward', () => {
    expect(pingAtOffset(0, -60)).toBe('attack');
    expect(pingAtOffset(-55, 30)).toBe('retreat');
    expect(pingAtOffset(55, 30)).toBe('gather');
    // Straight down lies between the two lower signals: either side of it goes its own way.
    expect(pingAtOffset(-5, 60)).toBe('retreat');
    expect(pingAtOffset(5, 60)).toBe('gather');
  });
});
