import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "./isTauri";

/** Applies Chrome-style page zoom to the whole window. */
export interface AppZoomTarget {
  readonly kind: "native" | "css";
  apply(scale: number): Promise<void>;
}

const nativeAppZoom: AppZoomTarget = {
  kind: "native",
  async apply(scale) {
    await getCurrentWebview().setZoom(scale);
  },
};

/** Browser preview (`pnpm dev`) has no webview API, so emulate page zoom in CSS. */
const cssAppZoom: AppZoomTarget = {
  kind: "css",
  async apply(scale) {
    if (typeof document === "undefined") return;
    document.documentElement.style.zoom = String(scale);
  },
};

export function createAppZoom(): AppZoomTarget {
  return isTauri() ? nativeAppZoom : cssAppZoom;
}
