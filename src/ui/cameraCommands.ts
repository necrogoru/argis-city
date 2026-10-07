import { RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from "@lucide/vue";
import { hasModKey, MOD_KEY_ARIA, type KeyLike } from "../composables/useModKey";
import type { CameraRigStore } from "../stores/cameraRig";

export interface CameraCommand {
  label: string;
  Icon: LucideIcon;
  /** `KeyboardEvent.key` values that run it with ⌘ (Ctrl off macOS). */
  keys?: readonly string[];
  run: (rig: CameraRigStore) => void;
}

/** Shared with the ⌘K palette so both surfaces offer the same camera moves. */
export const CAMERA_COMMANDS: readonly CameraCommand[] = [
  // "+" needs Shift on most layouts, so ⌘= zooms in too, as in browsers.
  { label: "Zoom in", Icon: ZoomIn, keys: ["=", "+"], run: (rig) => rig.zoomIn() },
  { label: "Zoom out", Icon: ZoomOut, keys: ["-"], run: (rig) => rig.zoomOut() },
  { label: "Reset view angle", Icon: RotateCcw, run: (rig) => rig.reset() },
  { label: "Fit city to view", Icon: Scan, keys: ["0"], run: (rig) => rig.fit() },
];

/** The camera command bound to this ⌘/Ctrl chord, if any. */
export function cameraCommandFor(event: KeyLike, mac?: boolean): CameraCommand | undefined {
  if (!hasModKey(event, mac)) return undefined;
  return CAMERA_COMMANDS.find((command) => command.keys?.includes(event.key));
}

/** `aria-keyshortcuts` value for `keys` ("+" is the separator, so it's spelled "Plus"). */
export function shortcutAria(keys: readonly string[] | undefined, mod = MOD_KEY_ARIA): string | undefined {
  return keys?.map((key) => `${mod}+${key === "+" ? "Plus" : key}`).join(" ");
}
