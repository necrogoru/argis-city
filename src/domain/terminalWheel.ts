const PIXEL_DELTA_MODE = 0;
const MINIMUM_ALT_BUFFER_DELTA_PX = 50;

/**
 * xterm 6.0.0 drops small pixel wheel deltas in the alternate buffer before
 * forwarding them to full-screen TUIs. Promote non-zero deltas so they reach
 * the app's mouse/key handling instead.
 *
 * Upstream issue: https://github.com/xtermjs/xterm.js/issues/6105
 */
export function normalizeAlternateBufferWheelDelta(
  deltaY: number,
  deltaMode: number,
  bufferType: "normal" | "alternate",
): number | null {
  if (
    bufferType !== "alternate" ||
    deltaMode !== PIXEL_DELTA_MODE ||
    !Number.isFinite(deltaY) ||
    deltaY === 0 ||
    Math.abs(deltaY) >= MINIMUM_ALT_BUFFER_DELTA_PX
  ) {
    return null;
  }

  return Math.sign(deltaY) * MINIMUM_ALT_BUFFER_DELTA_PX;
}
