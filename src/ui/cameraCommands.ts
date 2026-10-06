import { RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from "@lucide/vue";
import type { CameraRigStore } from "../stores/cameraRig";

export interface CameraCommand {
  label: string;
  Icon: LucideIcon;
  run: (rig: CameraRigStore) => void;
}

/** Shared with the ⌘K palette so both surfaces offer the same camera moves. */
export const CAMERA_COMMANDS: readonly CameraCommand[] = [
  { label: "Zoom in", Icon: ZoomIn, run: (rig) => rig.zoomIn() },
  { label: "Zoom out", Icon: ZoomOut, run: (rig) => rig.zoomOut() },
  { label: "Reset view angle", Icon: RotateCcw, run: (rig) => rig.reset() },
  { label: "Fit city to view", Icon: Scan, run: (rig) => rig.fit() },
];
