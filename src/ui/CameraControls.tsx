import { RotateCcw, Scan, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { useCameraRig } from "../scene/useCameraRig";
import type { CameraRig } from "../scene/cameraRig";
import { IconButton } from "./common/IconButton";
import styles from "./CameraControls.module.css";

const BUTTONS: ReadonlyArray<{ label: string; Icon: LucideIcon; run: (rig: CameraRig) => void }> = [
  { label: "Zoom in", Icon: ZoomIn, run: (rig) => rig.zoomIn() },
  { label: "Zoom out", Icon: ZoomOut, run: (rig) => rig.zoomOut() },
  { label: "Reset view angle", Icon: RotateCcw, run: (rig) => rig.reset() },
  { label: "Fit city to view", Icon: Scan, run: (rig) => rig.fit() },
];

/** 44px round glass buttons, bottom-left above the subagent strip. */
export function CameraControls() {
  const rig = useCameraRig();
  return (
    <div className={styles.controls} role="toolbar" aria-label="Camera">
      {BUTTONS.map(({ label, Icon, run }) => (
        <IconButton key={label} label={label} shape="round" size={44} onClick={() => run(rig)}>
          <Icon size={18} aria-hidden />
        </IconButton>
      ))}
    </div>
  );
}
