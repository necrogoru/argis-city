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
 * unlimited rate (camera moving) keeps the loop running continuously, and
 * `wake` renders the next frame at once (pointer input, state changes).
 */
export function createFrameDriver(loop: LoopControls, fps: () => number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let parked = false;
  /** A frame just ended and its park is queued behind the frame callback. */
  let parkPending = false;
  let disposed = false;

  function resume(): void {
    clearTimeout(timer);
    // Asked again before the queued park ran (a watcher flushing in the same
    // microtask queue): cancel the park and let the next vsync render.
    if (parkPending) {
      parkPending = false;
      return;
    }
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
      parkPending = true;
      queueMicrotask(() => {
        if (!parkPending || disposed) return;
        parkPending = false;
        loop.stop();
        parked = true;
      });
      clearTimeout(timer);
      timer = setTimeout(resume, frameDelayMs(rate));
    },
    /** Call when the rate changes: the new rate applies from a frame rendered now. */
    rateChanged(): void {
      resume();
    },
    /** Render the next frame now instead of when the timer is due. */
    wake(): void {
      resume();
    },
    /** Hand the loop back running, so a remounted driver is never stuck parked. */
    dispose(): void {
      resume();
      disposed = true;
    },
  };
}

/**
 * Pointer-move handler that calls `changed` only when the move lands on a
 * different object than the last one — a hover change worth rendering, not
 * every move.
 */
export function onTargetChange(changed: () => void): (event: { object: unknown }) => void {
  let last: unknown;
  return (event) => {
    if (event.object === last) return;
    last = event.object;
    changed();
  };
}
