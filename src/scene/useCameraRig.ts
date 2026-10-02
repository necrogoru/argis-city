import { useContext } from "react";
import { CameraRigContext } from "./CameraRigContext";
import type { CameraRig } from "./cameraRig";

/** Zoom in/out, reset, fit and focus — usable from DOM UI and scene alike. */
export function useCameraRig(): CameraRig {
  const rig = useContext(CameraRigContext);
  if (!rig) throw new Error("useCameraRig must be used inside <CameraRigProvider>");
  return rig;
}
