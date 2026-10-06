import { frameDelayMs } from "./frameRate";

/** The two TresJS loop controls the driver needs (`useLoop()` provides both). */
export interface LoopControls {
  start(): void;
  stop(): void;
}

/**
 * Runs TresJS's render loop at `fps` without waking the page on every vsync.
 * TresJS's own `fps-limit` still requests an animation frame each vsync and
 * skips most of them — and in WKWebView every one of those wake-ups costs a
 * rendering update in the page and the UI process. Instead, after each frame
 * the loop is parked and a timer restarts it when the next frame is due. An
 * unlimited rate (camera moving) keeps the loop running continuously.
 */
export function createFrameDriver(loop: LoopControls, fps: () => number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let parked = false;

  function resume(): void {
    clearTimeout(timer);
    if (!parked) return;
    parked = false;
    loop.start();
  }

  return {
    /** Call after every rendered frame. */
    afterFrame(): void {
      const rate = fps();
      if (!Number.isFinite(rate)) return;
      // Stop once the current animation-frame callback has returned, so the
      // frame it already re-requested is cancelled too.
      queueMicrotask(() => {
        loop.stop();
        parked = true;
      });
      clearTimeout(timer);
      timer = setTimeout(resume, frameDelayMs(rate));
    },
    /** Call when the rate changes: lifting the cap resumes at once. */
    rateChanged(): void {
      if (!Number.isFinite(fps())) resume();
    },
    dispose(): void {
      clearTimeout(timer);
    },
  };
}
