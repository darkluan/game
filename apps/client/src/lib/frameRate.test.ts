import { describe, expect, it } from 'vitest';
import { SlowFrameDetector } from './frameRate';

/** Feed `seconds` of frames at a steady rate; returns whether slowness was reported. */
function run(detector: SlowFrameDetector, fps: number, seconds: number): boolean {
  let reported = false;
  for (let i = 0; i < fps * seconds; i++) reported = detector.frame(1 / fps) || reported;
  return reported;
}

describe('SlowFrameDetector', () => {
  it('stays quiet on a machine that keeps up', () => {
    expect(run(new SlowFrameDetector(30), 60, 30)).toBe(false);
  });

  it('reports a machine that stays below the threshold, once', () => {
    const detector = new SlowFrameDetector(30);
    expect(run(detector, 20, 10)).toBe(true);
    expect(run(detector, 20, 10)).toBe(false);
  });

  it('ignores the warm-up while models load', () => {
    const detector = new SlowFrameDetector(30);
    expect(run(detector, 10, 3)).toBe(false);
    expect(run(detector, 60, 10)).toBe(false);
  });

  it('does not mistake a hidden tab for a slow machine', () => {
    const detector = new SlowFrameDetector(30);
    run(detector, 60, 5);
    expect(detector.frame(20)).toBe(false);
    expect(run(detector, 60, 10)).toBe(false);
  });
});
