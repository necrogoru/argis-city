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

/** Timer delay from one rendered frame to the next at `fps` (see frameDriver.ts). */
export function frameDelayMs(fps: number): number {
  return 1000 / fps - VSYNC_SLACK_MS;
}
