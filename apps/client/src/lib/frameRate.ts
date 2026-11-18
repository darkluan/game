/** Seconds to ignore after the scene starts: models are still loading and frames are uneven. */
const WARM_UP_SECONDS = 4;
const WINDOW_SECONDS = 4;

/**
 * Watches the frame rate and reports once when a whole window averaged below the threshold, the
 * sign of a machine that cannot keep up. Long gaps (a hidden tab) are not counted as slow frames.
 */
export class SlowFrameDetector {
  private elapsed = 0;
  private windowTime = 0;
  private windowFrames = 0;
  private reported = false;

  constructor(private readonly minFps: number) {}

  /** Feed one frame's duration in seconds. Returns true the one time slowness is detected. */
  frame(delta: number): boolean {
    if (this.reported || delta > 0.5) return false;
    this.elapsed += delta;
    if (this.elapsed < WARM_UP_SECONDS) return false;
    this.windowTime += delta;
    this.windowFrames++;
    if (this.windowTime < WINDOW_SECONDS) return false;
    const fps = this.windowFrames / this.windowTime;
    this.windowTime = 0;
    this.windowFrames = 0;
    this.reported = fps < this.minFps;
    return this.reported;
  }
}
