export type AppZoomAction = "in" | "out" | "reset";

type AppZoomKeyEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/** Chrome-style levels; 100% is home. */
export const APP_ZOOM_STEPS: readonly number[] = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export const DEFAULT_APP_ZOOM = 1;

/**
 * The app-zoom command bound to ⌘/Ctrl + key, browser-style. Shift is reserved
 * for the 3D camera, so shifted chords are ignored here.
 */
export function appZoomActionFor(event: AppZoomKeyEvent, mac: boolean): AppZoomAction | null {
  if (event.altKey || event.shiftKey) return null;
  if (!(mac ? event.metaKey : event.ctrlKey)) return null;
  if (event.key === "=" || event.key === "+") return "in";
  if (event.key === "-") return "out";
  if (event.key === "0") return "reset";
  return null;
}

/** The next level in Chrome-like steps, clamped to the ends. */
export function nextAppZoom(current: number, action: AppZoomAction): number {
  if (action === "reset") return DEFAULT_APP_ZOOM;
  if (action === "in") {
    return APP_ZOOM_STEPS.find((step) => step > current) ?? APP_ZOOM_STEPS[APP_ZOOM_STEPS.length - 1];
  }
  for (let index = APP_ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    if (APP_ZOOM_STEPS[index] < current) return APP_ZOOM_STEPS[index];
  }
  return APP_ZOOM_STEPS[0];
}

/** Snaps a persisted value onto a step, falling back to 100%. */
export function normalizeAppZoom(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return DEFAULT_APP_ZOOM;
  return APP_ZOOM_STEPS[nearestStepIndex(numeric)];
}

function nearestStepIndex(value: number): number {
  let nearest = 0;
  for (let index = 1; index < APP_ZOOM_STEPS.length; index += 1) {
    if (Math.abs(APP_ZOOM_STEPS[index] - value) < Math.abs(APP_ZOOM_STEPS[nearest] - value)) {
      nearest = index;
    }
  }
  return nearest;
}
