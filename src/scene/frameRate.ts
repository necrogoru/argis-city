/** Ambient animation rate (glows, sparks, dashes) while the window is focused. */
export const FOCUSED_FPS = 30;
/** …and while it sits unfocused beside other work, glanced at rather than used. */
export const BACKGROUND_FPS = 15;

/**
 * Frame-rate cap for the city canvas. In WKWebView every presented WebGL frame
 * carries a fixed cost (rendering update, GPU-process handoff, layer-tree
 * commit) regardless of scene size, so the frame rate is what CPU use scales
 * with. Ambient effects read the same at 30 fps (15 in the background); camera
 * moves render uncapped.
 */
export function fpsLimitFor({ moving, focused }: { moving: boolean; focused: boolean }): number {
  if (moving) return Infinity;
  return focused ? FOCUSED_FPS : BACKGROUND_FPS;
}

/** Fire this much early so vsync jitter never pushes a frame to the next vsync. */
const VSYNC_SLACK_MS = 4;

/**
 * The limit to hand TresJS's `fps-limit`. Its rAF loop (VueUse `useRafFn`) drops
 * any frame that arrives even slightly early, so asking for exactly 30 fps on a
 * 60 Hz display lands on every second *or third* vsync (~22 fps). Shortening the
 * accepted interval by a few ms makes it every second vsync, reliably.
 */
export function rafFpsLimit(fps: number): number {
  return Number.isFinite(fps) ? 1000 / (1000 / fps - VSYNC_SLACK_MS) : fps;
}
