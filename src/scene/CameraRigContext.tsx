import { createContext, useState, type ReactNode } from "react";
import { CameraRig } from "./cameraRig";

export const CameraRigContext = createContext<CameraRig | null>(null);

/** Owns the single CameraRig; the Canvas bridges this context into the scene. */
export function CameraRigProvider({ children }: { children: ReactNode }) {
  const [rig] = useState(() => new CameraRig());
  return <CameraRigContext.Provider value={rig}>{children}</CameraRigContext.Provider>;
}
