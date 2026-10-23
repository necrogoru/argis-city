import { RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from "@lucide/vue";
import { hasModKey, MOD_KEY_ARIA, type KeyLike } from "../composables/useModKey";
import type { CameraRigStore } from "../stores/cameraRig";

export interface CameraCommand {
  label: string;
  Icon: LucideIcon;
  /** `KeyboardEvent.key` values that run it with ⇧⌘ (Ctrl+Shift off macOS). */
  keys?: readonly string[];
  run: (rig: CameraRigStore) => void;
}

/** Shared with the ⌘K palette so both surfaces offer the same camera moves. */
export const CAMERA_COMMANDS: readonly CameraCommand[] = [
  // Shift keeps ⌘= / ⌘− / ⌘0 free for Chrome-style app zoom.
  { label: "Zoom in", Icon: ZoomIn, keys: ["+", "="], run: (rig) => rig.zoomIn() },
  { label: "Zoom out", Icon: ZoomOut, keys: ["_", "-"], run: (rig) => rig.zoomOut() },
  { label: "Reset view angle", Icon: RotateCcw, run: (rig) => rig.reset() },
  { label: "Fit city to view", Icon: Scan, keys: [")", "0"], run: (rig) => rig.fit() },
];

/** The camera command bound to this ⌘⇧/Ctrl+Shift chord, if any. */
export function cameraCommandFor(event: KeyLike, mac?: boolean): CameraCommand | undefined {
  if (!hasModKey(event, mac) || !event.shiftKey) return undefined;
  return CAMERA_COMMANDS.find((command) => command.keys?.includes(event.key));
}

const ARIA_KEY_NAMES: Readonly<Record<string, string>> = {
  "=": "Plus",
  "+": "Plus",
  "-": "Minus",
  _: "Minus",
  ")": "0",
  "0": "0",
};

/** `aria-keyshortcuts` value for the shifted `keys` ("+" is the separator, so it's spelled "Plus"). */
export function shortcutAria(keys: readonly string[] | undefined, mod = MOD_KEY_ARIA): string | undefined {
  const key = keys?.[0];
  if (key === undefined) return undefined;
  return `${mod}+Shift+${ARIA_KEY_NAMES[key] ?? key}`;
}
